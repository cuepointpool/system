# Deploying Cue Point to AWS — EC2 `t3.micro` + CloudFront

A complete runbook for a **cheap, single-instance** deployment:

```
Browser ──HTTPS──▶ CloudFront (free TLS, global cache, 1 TB/mo free)
                        │  http-only, forwards Host + cookies
                        ▼
              EC2 t3.micro (Ubuntu 24.04, ap-south-1 / Mumbai)
                ├─ Nginx  :80  ──▶  Next.js (systemd) :3000
                └─ PostgreSQL :5432 (local)  ──nightly pg_dump──▶ S3
```

**Cost:** ~**$0 for 12 months** (Free Tier: 750 h/mo `t3.micro`, 30 GB gp3, 100 GB egress; CloudFront 1 TB + 10M req/mo free *forever*). After 12 months ≈ **$8–12/mo**.
**No load balancer** — add an ALB + 2nd instance later if you go multi-branch (~$16/mo more). No re-architecture needed.

Region used throughout: **`ap-south-1`** (Mumbai — closest low-latency region to Sri Lanka).

---

## 0. Prerequisites (do these once)

### 0a. AWS access key

1. AWS Console → **IAM** → **Users** → **Create user** → name `cuepoint-deploy` → **Next**.
2. **Attach policies directly** → tick **`AdministratorAccess`** → **Next** → **Create user**.
3. Open `cuepoint-deploy` → **Security credentials** tab → **Create access key** → use case **Command Line Interface (CLI)** → confirm → **Create access key**.
4. Copy the **Access key ID** (`AKIA…`) and **Secret access key** (shown once).

> **Delete this user when the deploy is finished and stable** (IAM → Users → `cuepoint-deploy` → Delete). That permanently revokes the key.

### 0b. AWS CLI

Already installed on this machine at:
`/c/Users/Onyx/AppData/Roaming/Python/Python313/Scripts/aws`

Add it to PATH for the shell you deploy from, or use the full path. Then:

```bash
aws configure
# AWS Access Key ID:     <paste AKIA…>
# AWS Secret Access Key: <paste secret>
# Default region name:   ap-south-1
# Default output format:  json

aws sts get-caller-identity      # should print your account id — auth OK
```

### 0c. Repo

`https://github.com/cuepointpool/system` is **public** — the instance clones it over HTTPS, nothing else needed. If it's ever made private, add a read-only **Deploy Key** (see §9).

---

## 1. Set shell variables

```bash
export AWS_DEFAULT_REGION=ap-south-1
export AWS_PAGER=""                       # stop the CLI opening a pager
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "account: $ACCOUNT_ID"
```

---

## 2. SSH key pair

```bash
aws ec2 create-key-pair --key-name cuepoint-key \
  --query 'KeyMaterial' --output text > cuepoint-key.pem
chmod 400 cuepoint-key.pem            # git-bash; on plain Windows use:
# icacls cuepoint-key.pem /inheritance:r /grant:r "%USERNAME%:R"
```

Keep `cuepoint-key.pem` safe — it's the only way to SSH in.

---

## 3. Networking (default VPC) + security group

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text)

SG_ID=$(aws ec2 create-security-group --group-name cuepoint-sg \
  --description "Cue Point web" --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text)
echo "SG: $SG_ID"

MYIP=$(curl -s https://checkip.amazonaws.com)
# SSH only from your current IP
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 22 --cidr "${MYIP}/32"
# HTTP from anywhere for now — locked to CloudFront in §8
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
```

---

## 4. Instance IAM role (S3 backups + SSM shell access)

```bash
cat > ec2-trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
"Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF

aws iam create-role --role-name cuepoint-ec2-role \
  --assume-role-policy-document file://ec2-trust.json
aws iam attach-role-policy --role-name cuepoint-ec2-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam create-instance-profile --instance-profile-name cuepoint-ec2-profile
aws iam add-role-to-instance-profile \
  --instance-profile-name cuepoint-ec2-profile --role-name cuepoint-ec2-role
```

### S3 backup bucket

```bash
BUCKET="cuepoint-backups-${ACCOUNT_ID}"
aws s3api create-bucket --bucket "$BUCKET" --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

cat > lifecycle.json <<'EOF'
{"Rules":[{"ID":"expire-7d","Filter":{"Prefix":"pg/"},
"Status":"Enabled","Expiration":{"Days":7}}]}
EOF
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration file://lifecycle.json

cat > s3-policy.json <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
"Action":["s3:PutObject","s3:ListBucket"],
"Resource":["arn:aws:s3:::${BUCKET}","arn:aws:s3:::${BUCKET}/*"]}]}
EOF
aws iam put-role-policy --role-name cuepoint-ec2-role \
  --policy-name cuepoint-s3-backup --policy-document file://s3-policy.json
```

---

## 5. Bootstrap script (`user-data.sh`)

Save this file next to your terminal as **`user-data.sh`**. It runs once, as root, on first boot. Fill in `S3_BUCKET` at the top.

```bash
#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

S3_BUCKET="cuepoint-backups-CHANGE_ME"     # <-- your $BUCKET from §4
REPO="https://github.com/cuepointpool/system.git"

# --- 2 GB swap so `next build` doesn't OOM on 1 GB RAM ---
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# --- base packages ---
apt-get update
apt-get install -y curl git nginx postgresql postgresql-contrib unzip

# --- Node 20 ---
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# --- AWS CLI v2 (for nightly backups) ---
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp && /tmp/aws/install
rm -rf /tmp/aws /tmp/awscliv2.zip

# --- PostgreSQL: db + user ---
DB_PASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)
sudo -u postgres psql -c "CREATE USER cuepoint WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "CREATE DATABASE cuepoint OWNER cuepoint;"

# --- app user + code ---
useradd -m -s /bin/bash cuepoint || true
sudo -u cuepoint git clone "$REPO" /home/cuepoint/app

SESSION_SECRET=$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48)
cat > /home/cuepoint/app/.env <<EOF
DATABASE_URL=postgresql://cuepoint:${DB_PASS}@localhost:5432/cuepoint
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=3000
EOF
chown cuepoint:cuepoint /home/cuepoint/app/.env
chmod 600 /home/cuepoint/app/.env

# build + seed the database (schema + venue tables + 4 partner slots)
sudo -u cuepoint bash -lc 'cd ~/app && npm ci && npm run build && npm run db:setup'

# --- systemd service (auto-restart on crash/reboot) ---
cat > /etc/systemd/system/cuepoint.service <<'EOF'
[Unit]
Description=Cue Point (Next.js)
After=network.target postgresql.service

[Service]
Type=simple
User=cuepoint
WorkingDirectory=/home/cuepoint/app
EnvironmentFile=/home/cuepoint/app/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now cuepoint

# --- Nginx reverse proxy ---
cat > /etc/nginx/sites-available/cuepoint <<'EOF'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/cuepoint /etc/nginx/sites-enabled/cuepoint
nginx -t && systemctl restart nginx

# --- passwordless restart for the deploy script ---
echo 'cuepoint ALL=(root) NOPASSWD: /bin/systemctl restart cuepoint, /bin/systemctl status cuepoint' \
  > /etc/sudoers.d/cuepoint
chmod 440 /etc/sudoers.d/cuepoint

# --- nightly DB backup to S3 (02:30, 7-day retention via bucket lifecycle) ---
cat > /usr/local/bin/cuepoint-backup.sh <<EOF
#!/bin/bash
set -e
TS=\$(date +%Y%m%d-%H%M%S)
sudo -u postgres pg_dump cuepoint | gzip > /tmp/cuepoint-\${TS}.sql.gz
/usr/local/bin/aws s3 cp /tmp/cuepoint-\${TS}.sql.gz s3://${S3_BUCKET}/pg/cuepoint-\${TS}.sql.gz
rm -f /tmp/cuepoint-\${TS}.sql.gz
EOF
chmod +x /usr/local/bin/cuepoint-backup.sh
echo "30 2 * * * root /usr/local/bin/cuepoint-backup.sh" > /etc/cron.d/cuepoint-backup

# --- deploy script (used by GitHub Actions in §9) ---
cat > /home/cuepoint/deploy.sh <<'EOF'
#!/bin/bash
set -e
cd /home/cuepoint/app
git pull --ff-only
npm ci
npm run build
sudo systemctl restart cuepoint
EOF
chmod +x /home/cuepoint/deploy.sh
chown cuepoint:cuepoint /home/cuepoint/deploy.sh

echo "BOOTSTRAP DONE" > /var/log/cuepoint-bootstrap.done
```

> **Do not** export `NODE_ENV=production` in the shell before `npm ci` — the build needs the dev dependency `tsx` for `npm run db:setup`.

---

## 6. Launch the instance

```bash
# latest Ubuntu 24.04 LTS x86_64 AMI (Canonical, via SSM public parameter)
AMI_ID=$(aws ssm get-parameter \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
  --query 'Parameter.Value' --output text)
echo "AMI: $AMI_ID"

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type t3.micro \
  --key-name cuepoint-key \
  --security-group-ids "$SG_ID" \
  --iam-instance-profile Name=cuepoint-ec2-profile \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --user-data file://user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cuepoint}]' \
  --query 'Instances[0].InstanceId' --output text)
echo "instance: $INSTANCE_ID"

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
```

### Stable public IP (Elastic IP — free while attached)

```bash
ALLOC_ID=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOC_ID"

EIP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC_ID" --query 'Addresses[0].PublicIp' --output text)
EC2_DNS="ec2-${EIP//./-}.ap-south-1.compute.amazonaws.com"
echo "IP:  $EIP"
echo "DNS: $EC2_DNS"
```

### Wait for bootstrap (~5–9 min on t3.micro: apt + npm ci + next build)

```bash
# option A: poll the site
until curl -s -o /dev/null -w '%{http_code}\n' "http://$EIP" | grep -q 200; do
  echo "still bootstrapping…"; sleep 20; done
echo "app is up on http://$EIP"

# option B: watch the log over SSH
ssh -i cuepoint-key.pem ubuntu@$EIP 'sudo tail -f /var/log/cloud-init-output.log'
```

Sanity check on the box:

```bash
ssh -i cuepoint-key.pem ubuntu@$EIP '
  systemctl is-active cuepoint nginx postgresql
  curl -sI localhost | head -1
  sudo -u postgres psql cuepoint -c "\dt" | head'
```

---

## 7. CloudFront distribution

Save as **`cf-config.json`** — replace `EC2_PUBLIC_DNS` with `$EC2_DNS` from §6 and put a unique string in `CallerReference`.

```json
{
  "CallerReference": "cuepoint-2026-09-01-a",
  "Comment": "Cue Point",
  "Enabled": true,
  "PriceClass": "PriceClass_200",
  "Origins": { "Quantity": 1, "Items": [{
    "Id": "ec2-origin",
    "DomainName": "EC2_PUBLIC_DNS",
    "CustomOriginConfig": {
      "HTTPPort": 80, "HTTPSPort": 443,
      "OriginProtocolPolicy": "http-only",
      "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
      "OriginReadTimeout": 30, "OriginKeepaliveTimeout": 5
    }
  }]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "ec2-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "AllowedMethods": { "Quantity": 7,
      "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] } },
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
  },
  "CacheBehaviors": { "Quantity": 2, "Items": [
    { "PathPattern": "/_next/static/*", "TargetOriginId": "ec2-origin",
      "ViewerProtocolPolicy": "redirect-to-https", "Compress": true,
      "AllowedMethods": { "Quantity": 3, "Items": ["GET","HEAD","OPTIONS"],
        "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] } },
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6" },
    { "PathPattern": "/media/*", "TargetOriginId": "ec2-origin",
      "ViewerProtocolPolicy": "redirect-to-https", "Compress": true,
      "AllowedMethods": { "Quantity": 3, "Items": ["GET","HEAD","OPTIONS"],
        "CachedMethods": { "Quantity": 2, "Items": ["GET","HEAD"] } },
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6" }
  ]}
}
```

Managed-policy IDs used above (same in every account):
`4135ea2d-6df8-44a3-9df3-4b5a84be39ad` = **CachingDisabled** ·
`216adef6-5c7f-47e4-b989-5492eafa07d3` = **AllViewer** (forwards Host, cookies, query, headers) ·
`658327ea-f89d-4fab-a63d-7e88639e58f6` = **CachingOptimized**.

```bash
sed -i "s/EC2_PUBLIC_DNS/$EC2_DNS/" cf-config.json

CF_JSON=$(aws cloudfront create-distribution --distribution-config file://cf-config.json)
CF_ID=$(echo "$CF_JSON"  | python -c 'import sys,json;print(json.load(sys.stdin)["Distribution"]["Id"])')
CF_DOMAIN=$(echo "$CF_JSON" | python -c 'import sys,json;print(json.load(sys.stdin)["Distribution"]["DomainName"])')
echo "CloudFront: https://$CF_DOMAIN  (id $CF_ID)"

# wait until deployed (~5–15 min)
aws cloudfront wait distribution-deployed --id "$CF_ID"
curl -sI "https://$CF_DOMAIN" | head -1        # expect: HTTP/2 200
```

---

## 8. Lock the instance to CloudFront only

Once CloudFront serves the site, stop the origin accepting direct traffic:

```bash
PREFIX_ID=$(aws ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)

aws ec2 revoke-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --ip-permissions IpProtocol=tcp,FromPort=80,ToPort=80,PrefixListIds="[{PrefixListId=$PREFIX_ID,Description=cloudfront}]"
```

SSH (port 22 from your IP) stays. `http://$EIP` will now time out; `https://$CF_DOMAIN` still works.

---

## 9. First login + auto-deploy on push

### First admin
Open `https://$CF_DOMAIN/account` → register. **The first account becomes the admin.** Then `/admin`.

### Auto-deploy (GitHub Actions → SSH → `deploy.sh`)

In the repo: **Settings → Secrets and variables → Actions → New repository secret**
- `EC2_HOST` = the Elastic IP (`$EIP`)
- `EC2_SSH_KEY` = full contents of `cuepoint-key.pem`

Add `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: sudo -u cuepoint /home/cuepoint/deploy.sh
```

Now every `git push` to `main` rebuilds and restarts the app on the box.

> **Private repo instead?** On the box: `sudo -u cuepoint ssh-keygen -t ed25519 -f /home/cuepoint/.ssh/id_ed25519 -N ""`, then add the **public** key (`/home/cuepoint/.ssh/id_ed25519.pub`) to GitHub → repo **Settings → Deploy keys** (read-only), and change the clone URL to `git@github.com:cuepointpool/system.git`.

---

## 10. Add your domain later

CloudFront certs must live in **`us-east-1`**.

```bash
CERT_ARN=$(aws acm request-certificate --region us-east-1 \
  --domain-name cuepoint.example --subject-alternative-names www.cuepoint.example \
  --validation-method DNS --query CertificateArn --output text)

# print the DNS validation records to add at your registrar / Route 53
aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord'
aws acm wait certificate-validated --region us-east-1 --certificate-arn "$CERT_ARN"
```

Then in the CloudFront distribution (console is easiest): **Settings → Edit** → add the domain(s) under **Alternate domain names (CNAME)**, choose **Custom SSL certificate** = the ACM cert → Save. Finally point a DNS **A/ALIAS** record for the domain at `$CF_DOMAIN`.

---

## 11. Everyday operations

| Task | Command |
|---|---|
| SSH in | `ssh -i cuepoint-key.pem ubuntu@$EIP` |
| App logs | `ssh … 'journalctl -u cuepoint -f'` |
| Restart app | `ssh … 'sudo systemctl restart cuepoint'` |
| Manual deploy | `ssh … 'sudo -u cuepoint /home/cuepoint/deploy.sh'` |
| Run a migration | `ssh … 'cd /home/cuepoint/app && sudo -u postgres psql cuepoint -f db/migrations/<file>.sql'` |
| Manual backup now | `ssh … 'sudo /usr/local/bin/cuepoint-backup.sh'` |
| List backups | `aws s3 ls s3://$BUCKET/pg/` |
| Restore a backup | `aws s3 cp s3://$BUCKET/pg/<file>.sql.gz - \| gunzip \| ssh … 'sudo -u postgres psql cuepoint'` |
| Invalidate CDN cache | `aws cloudfront create-invalidation --distribution-id $CF_ID --paths '/*'` |

---

## 12. Cost & teardown

**Free Tier (first 12 months, if no other free-tier instance is running):** `t3.micro` 750 h/mo, 30 GB gp3, 100 GB egress. **CloudFront:** 1 TB egress + 10M requests/mo **free forever**. S3 backups: a few cents.
**After 12 months:** ≈ `t3.micro` $7.5 + EBS $2.4 ≈ **$10/mo** (less with a Savings Plan).

**Full teardown:**

```bash
aws cloudfront get-distribution-config --id "$CF_ID"        # note the ETag
# set "Enabled": false via update-distribution, wait, then:
aws cloudfront delete-distribution --id "$CF_ID" --if-match <ETag>

aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"
aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID"
aws ec2 release-address --allocation-id "$ALLOC_ID"
aws ec2 delete-security-group --group-id "$SG_ID"
aws ec2 delete-key-pair --key-name cuepoint-key

aws iam remove-role-from-instance-profile --instance-profile-name cuepoint-ec2-profile --role-name cuepoint-ec2-role
aws iam delete-instance-profile --instance-profile-name cuepoint-ec2-profile
aws iam delete-role-policy --role-name cuepoint-ec2-role --policy-name cuepoint-s3-backup
aws iam detach-role-policy --role-name cuepoint-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam delete-role --role-name cuepoint-ec2-role
aws s3 rb "s3://$BUCKET" --force
```

**Then delete the IAM user `cuepoint-deploy`** (IAM → Users → Delete).

---

## 13. Notes / gotchas

- **DB in the cloud:** the app's local `.env` points `DATABASE_URL` at `localhost` — the bootstrap script writes a fresh `.env` on the instance with Postgres running there, so nothing to change.
- **`next build` memory:** the 2 GB swap in `user-data.sh` is what lets the build finish on a 1 GB instance. Don't skip it.
- **Secure cookies:** `lib/auth.ts` sets the session cookie without `Secure`. It works fine behind CloudFront HTTPS; optionally add `secure: process.env.NODE_ENV === "production"` to the `res.cookies.set(...)` calls for defence in depth.
- **Migrations** in `db/migrations/*.sql` are **not** auto-applied — run them manually (see §11) after a deploy that adds one. `npm run db:setup` **drops and recreates** the schema; only run it on first install.
- **Scaling up:** bigger box → change `--instance-type` (stop instance, `modify-instance-attribute`, start). True HA → put an ALB in front, launch a 2nd instance from an AMI of the first, move Postgres to RDS.

/* ============================================================
   Database setup: apply db/schema.sql, then insert the venue's
   own configuration — membership tiers, the achievement
   catalogue, the loyalty-reward catalogue and the Cue Point
   venue record.

   NO players, matches, tournaments, promotions or activity are
   inserted. Those are all created through the app (sign-up + the
   staff console). The first account to register becomes the admin.

   Campaign missions are NOT seeded — that content lives in
   lib/campaign/content.ts; only per-player progress is in the DB.

   Run:  npm run db:setup
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (run via `npm run db:setup`).");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

/* ---- venue configuration (edit these to match the business) ---- */

const MEMBERSHIP_PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 0,
    billing_period: "monthly",
    tagline: "Your Cue Point identity — free forever",
    benefits: [
      "Member table pricing",
      "Full booking history",
      "Public player profile & stats",
      "Loyalty points on every visit",
    ],
    discount_pct: 0,
    booking_priority: 1,
    loyalty_multiplier: 1,
    badge: "Member",
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 1500,
    billing_period: "monthly",
    tagline: "For players in the ranked scene",
    benefits: [
      "10% off all table time",
      "Priority booking window (48h ahead)",
      "Ranked & league match eligibility",
      "20% off tournament entry",
      "1.5× loyalty earning",
    ],
    discount_pct: 10,
    booking_priority: 2,
    loyalty_multiplier: 1.5,
    badge: "Pro",
    featured: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: 3500,
    billing_period: "monthly",
    tagline: "The full Cue Point membership",
    benefits: [
      "18% off all table time",
      "Top booking priority (7 days ahead)",
      "Free entry to premium tournaments",
      "Elite player badge on your profile",
      "2× loyalty earning + monthly bonus",
      "Exclusive promotions & guest passes",
    ],
    discount_pct: 18,
    booking_priority: 3,
    loyalty_multiplier: 2,
    badge: "Elite",
    featured: false,
  },
];

/* The starting floor — 3 named tables. Admins add / rename / retire these
   from the console (Tables tab); the booking flow reads them live. */
const VENUE_TABLES = [
  {
    id: "table-1",
    label: "Table 1 — The Baize",
    area: "Main floor",
    note: "9ft King Model · tournament cloth",
    seats: 4,
  },
  {
    id: "table-2",
    label: "Table 2 — The Rail",
    area: "Main floor",
    note: "9ft King Model · tournament cloth",
    seats: 4,
  },
  {
    id: "table-3",
    label: "Table 3 — The Booth",
    area: "Private VIP booth",
    note: "9ft King Model · lounge seating + table service",
    seats: 8,
  },
];

const ACHIEVEMENTS = [
  ["first_win", "First Blood", "Won your first recorded match", "target", "bronze"],
  ["streak5", "On Fire", "Won 5 ranked matches in a row", "flame", "silver"],
  ["giant_killer", "Giant Killer", "Beat a top-3 ranked player", "sword", "gold"],
  ["century", "Century Maker", "Recorded a 100+ break", "break", "gold"],
  ["champion", "Tournament Champion", "Won a Cue Point tournament", "trophy", "platinum"],
  ["podium", "On the Podium", "Finished top 3 on the monthly board", "podium", "silver"],
  ["veteran", "Rail Veteran", "Played 40+ recorded matches", "shield", "silver"],
  ["ranked50", "Ranked Regular", "50 ranked matches played", "ladder", "bronze"],
  ["loyal", "House Favourite", "Earned 5,000+ lifetime loyalty points", "star", "silver"],
  ["founder", "Founding Member", "One of the first Cue Point members", "flag", "gold"],
  ["comeback", "Comeback Kid", "Won from 0-4 down in a race to 5", "bolt", "gold"],
  ["unbeaten_month", "Untouchable", "A calendar month without a loss", "crown", "platinum"],
];

const REWARDS = [
  ["rw_play30", "30 minutes free play", "On any standard pool table", 800, "play", "clock"],
  ["rw_play60", "1 hour free play", "On any standard pool table", 1500, "play", "clock"],
  ["rw_disc15", "15% booking discount", "One booking, up to 3 hours", 1000, "discount", "tag"],
  ["rw_tourney", "Tournament entry credit", "LKR 1,500 toward any entry fee", 2200, "tournament", "trophy"],
  ["rw_food", "Snack & drink combo", "From the Cue Point bar", 600, "food", "cup"],
  ["rw_merch", "Cue Point chalk + glove set", "Branded player kit", 3000, "merch", "box"],
];

async function main() {
  await client.connect();
  console.log("→ setup", new URL(process.env.DATABASE_URL!).pathname.slice(1));

  await client.query(schema);
  console.log("✓ schema applied");

  await client.query("BEGIN");
  try {
    // four partner slots for the business-finance module (rename in the console)
    for (let i = 1; i <= 4; i++) {
      await client.query(
        `INSERT INTO business_partners (id, name, sort_order) VALUES ($1,$2,$3)`,
        [`bp_${i}`, `Partner ${i}`, i - 1],
      );
    }

    for (let i = 0; i < VENUE_TABLES.length; i++) {
      const t = VENUE_TABLES[i];
      await client.query(
        `INSERT INTO venue_tables (id,label,area,note,seats,sort_order,active)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
        [t.id, t.label, t.area, t.note, t.seats, i],
      );
    }

    for (let i = 0; i < MEMBERSHIP_PLANS.length; i++) {
      const p = MEMBERSHIP_PLANS[i];
      await client.query(
        `INSERT INTO membership_plans
          (id,name,price,billing_period,tagline,benefits,discount_pct,
           booking_priority,loyalty_multiplier,badge,featured,status,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12)`,
        [
          p.id, p.name, p.price, p.billing_period, p.tagline,
          JSON.stringify(p.benefits), p.discount_pct, p.booking_priority,
          p.loyalty_multiplier, p.badge, p.featured, i,
        ],
      );
    }

    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const [id, name, desc, icon, tier] = ACHIEVEMENTS[i];
      await client.query(
        `INSERT INTO achievements (id,name,description,icon,tier,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, name, desc, icon, tier, i],
      );
    }

    for (let i = 0; i < REWARDS.length; i++) {
      const [id, name, desc, cost, cat, icon] = REWARDS[i];
      await client.query(
        `INSERT INTO rewards (id,name,description,cost,category,icon,status,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,'active',$7)`,
        [id, name, desc, cost, cat, icon, i],
      );
    }

    await client.query(
      `INSERT INTO venues
        (id,slug,name,logo,cover,district,city,address,table_count,table_types,
         hourly_rate_from,facilities,phone,socials,maps_url,rating,review_count,
         online_booking,hosts_tournaments,is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        "v_cuepoint", "cue-point", "Cue Point Pool Parlour",
        "/media/logo-mark.png", "/media/cover.png", "Colombo", "Homagama",
        "Pitipana, Homagama, Sri Lanka", 3,
        JSON.stringify(["9ft King Model (main floor)", "9ft King Model (VIP booth)"]), 800,
        JSON.stringify(["Espresso & mocktail bar", "Private VIP booth", "Coaching", "Live rankings"]),
        "+94 77 026 2675",
        JSON.stringify({ instagram: "https://instagram.com", facebook: "https://facebook.com" }),
        "https://www.google.com/maps/search/?api=1&query=Pitipana+Homagama",
        null, 0, true, true, true,
      ],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  console.log(
    `✓ config inserted: ${VENUE_TABLES.length} tables, ` +
      `${MEMBERSHIP_PLANS.length} membership plans, ` +
      `${ACHIEVEMENTS.length} achievements, ${REWARDS.length} rewards, 1 venue`,
  );
  console.log("  Register the first account at /account — it becomes the admin.");
  await client.end();
}

main().catch(async (err) => {
  console.error("✗ setup failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
});

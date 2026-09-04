import { CampaignImage } from "./CampaignImage";
import { CoinIcon, FlagIcon, StarIcon, XpIcon } from "./Icons";
import { ARTWORK } from "@/lib/campaign/content";
import type { CampaignSummary } from "@/lib/campaign/progress";

/**
 * Full-bleed campaign hero. Opens the screen on the branded room shot — the
 * artwork already carries the Cue Point logo and the "more than just a game"
 * wall, so the header leans on it instead of repeating the branding in type.
 */
export function CampaignHeader({ summary }: { summary: CampaignSummary }) {
  return (
    // pulled up under the translucent top bar so the artwork runs to the very
    // top of the screen, the way a game splash does
    <header className="relative -mx-4 -mt-[calc(3.5rem+env(safe-area-inset-top,0px))] overflow-hidden">
      <div className="relative h-[400px] sm:h-[440px]">
        <CampaignImage
          src={ARTWORK.venue}
          focus="42% 30%"
          alt=""
          className="absolute inset-0 h-full w-full"
          sizes="100vw"
          priority
        />
        {/* bottom-weighted scrim so the type always lands on darkness */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.55)_0%,rgba(5,16,28,0.18)_28%,rgba(5,16,28,0.82)_72%,var(--color-navy-950)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_100%,rgba(0,194,168,0.22),transparent_70%)]" />

        <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
          <h2 className="font-display text-[34px] font-bold uppercase leading-[0.92] tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-[42px]">
            Campaign <span className="text-teal">Mode</span>
          </h2>
          <p className="mt-2 max-w-[17rem] text-[11px] uppercase leading-relaxed tracking-[0.16em] text-white/75 sm:text-[12px]">
            Rise through the ranks.
            <br />
            Prove your precision.
          </p>
        </div>
      </div>

      {/* stat ribbon straddling the hero and the content below it */}
      <dl className="mx-4 -mt-1 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/10">
        <Stat
          icon={<XpIcon className="h-4 w-4" />}
          value={String(summary.level)}
          label="Level"
        />
        <Stat
          icon={<FlagIcon className="h-4 w-4 text-teal" />}
          value={`${summary.missionsCompleted}`}
          label="Missions"
        />
        <Stat
          icon={<StarIcon className="h-4 w-4 text-gold" />}
          value={String(summary.starsEarned)}
          label="Stars"
        />
        <Stat
          icon={<CoinIcon className="h-4 w-4" />}
          value={compact(summary.coins)}
          label="Coins"
        />
      </dl>
    </header>
  );
}

function compact(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-navy-950/90 px-1 py-2.5 text-center backdrop-blur-sm">
      <dd className="flex items-center justify-center gap-1">
        {icon}
        <span className="font-display text-[15px] font-bold tabular-nums text-white">
          {value}
        </span>
      </dd>
      <dt className="mt-0.5 text-[9px] uppercase tracking-wider text-mist/70">{label}</dt>
    </div>
  );
}

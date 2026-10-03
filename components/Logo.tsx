import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import logoMark from "@/public/media/logo-mark.png";

export function Logo({
  className,
  compact = false,
  href = "/",
}: {
  className?: string;
  compact?: boolean;
  href?: string | null;
}) {
  const content = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      {/* white disc: the navy half of the mark is invisible on a navy page */}
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white">
        <Image
          src={logoMark}
          alt="Cue Point"
          width={40}
          height={40}
          priority
          className="h-8 w-8 object-contain"
        />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-[0.22em] text-white">
            CUE&nbsp;POINT
          </span>
          <span className="mt-1 text-[9px] font-medium tracking-[0.42em] text-teal">
            POOL&nbsp;PARLOUR
          </span>
        </span>
      )}
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} aria-label="Cue Point — home" className="inline-block">
      {content}
    </Link>
  );
}

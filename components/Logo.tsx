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
      <span className="relative grid h-9 w-9 place-items-center">
        <span className="absolute inset-0 rounded-full bg-teal/25 blur-md transition-opacity duration-500 group-hover:opacity-100 opacity-60" />
        <Image
          src={logoMark}
          alt="Cue Point"
          width={40}
          height={40}
          priority
          className="relative h-9 w-9 object-contain drop-shadow-[0_2px_10px_rgba(0,194,168,0.35)]"
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

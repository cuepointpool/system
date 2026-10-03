import Image from "next/image";
import { cn } from "@/lib/utils";
import logoMark from "@/public/media/logo-mark.png";

/**
 * The Cue Point mark on a white disc. Half of the mark is deep navy, which
 * disappears on the site's navy backgrounds, so it always sits on white.
 */
export function BrandMark({
  size = 28,
  className,
  alt = "",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full bg-white", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={logoMark}
        alt={alt}
        width={size}
        height={size}
        className="h-[80%] w-[80%] object-contain"
      />
    </span>
  );
}

/** The small teal label above a section heading, led by the mark. */
export function SectionKicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.32em] text-teal",
        className,
      )}
    >
      <BrandMark size={22} />
      <span>{children}</span>
    </span>
  );
}

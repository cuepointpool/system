"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "campaign";
  className?: string;
  strength?: number;
  ariaLabel?: string;
  block?: boolean;
};

export function MagneticButton({
  children,
  href,
  onClick,
  variant = "primary",
  className,
  strength = 0.35,
  ariaLabel,
  block = false,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(my, { stiffness: 220, damping: 16, mass: 0.4 });
  const labelX = useSpring(mx, { stiffness: 320, damping: 20 });
  const labelY = useSpring(my, { stiffness: 320, damping: 20 });

  function handleMove(e: React.MouseEvent) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - (r.left + r.width / 2)) * strength);
    my.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function reset() {
    mx.set(0);
    my.set(0);
  }

  const cls = cn(
    "inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm md:text-[15px] will-change-transform",
    variant === "primary"
      ? "btn-primary"
      : variant === "campaign"
        ? "btn-campaign"
        : "btn-ghost",
    className,
  );

  const wrapCls = block
    ? "flex w-full text-left"
    : "inline-flex w-max max-w-full self-start text-left";

  const inner = (
    <motion.span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x, y }}
      className={cn(cls, block && "w-full")}
      data-cursor="hot"
    >
      <motion.span style={{ x: labelX, y: labelY }} className="inline-flex items-center gap-2">
        {children}
      </motion.span>
    </motion.span>
  );

  if (href) {
    const external = href.startsWith("http");
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className={wrapCls}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={wrapCls}
    >
      {inner}
    </button>
  );
}

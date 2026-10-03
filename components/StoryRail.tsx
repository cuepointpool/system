"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Horizontal, swipeable rail for the story cards. Native scroll-snap does the
   swiping on touch/trackpad; the arrows and mouse drag cover desktop. */

export function StoryRail({ children }: { children: React.ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startLeft: 0 });
  const [edge, setEdge] = useState({ start: true, end: false });

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync]);

  const step = (dir: 1 | -1) => {
    const el = rail.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !rail.current) return;
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startLeft: rail.current.scrollLeft,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = rail.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    d.moved = true;
    el.style.scrollSnapType = "none";
    el.scrollLeft = d.startLeft - dx;
  };

  const endDrag = () => {
    const el = rail.current;
    if (!drag.current.active) return;
    drag.current.active = false;
    if (el) el.style.scrollSnapType = "";
  };

  // A drag that started on a button must not follow the link.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div className="relative mt-12">
      <div
        ref={rail}
        onScroll={sync}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className="hide-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 md:-mx-8 md:scroll-px-8 md:px-8 lg:-mx-12 lg:scroll-px-12 lg:px-12 lg:cursor-grab lg:active:cursor-grabbing"
      >
        {children}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <RailButton label="Previous" disabled={edge.start} onClick={() => step(-1)}>
          <path d="M15 5l-7 7 7 7" />
        </RailButton>
        <RailButton label="Next" disabled={edge.end} onClick={() => step(1)}>
          <path d="M9 5l7 7-7 7" />
        </RailButton>
      </div>
    </div>
  );
}

function RailButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy-950 transition-colors duration-200 hover:bg-gold disabled:cursor-default disabled:bg-white/15 disabled:text-white/40"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

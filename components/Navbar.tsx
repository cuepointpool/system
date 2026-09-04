"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "./Logo";
import { MagneticButton } from "./MagneticButton";
import { scrollToId } from "./SmoothScroll";
import { PlayerAvatar } from "./eco/Primitives";
import { ACCOUNT_NAV, MAIN_NAV, type NavItem } from "@/lib/config";
import { cn } from "@/lib/utils";

type Viewer = {
  slug: string;
  nickname: string;
  fullName: string;
  membershipTier: string;
  role: "player" | "staff" | "admin";
  rank: number;
} | null;

type Partner = {
  name: string;
  username: string | null;
  positions: string[];
  canEditFinance: boolean;
} | null;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const onHome = pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [viewer, setViewer] = useState<Viewer>(null);
  const [partner, setPartner] = useState<Partner>(null);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setHidden(y > 420 && y > last && !open);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const loadViewer = useCallback(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setViewer(d.viewer);
        setPartner(d.partner ?? null);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadViewer();
  }, [loadViewer, pathname]);

  const isPartner = !viewer && !!partner;

  async function signOut() {
    await fetch(isPartner ? "/api/partner/logout" : "/api/auth/logout", {
      method: "POST",
    });
    setAcctOpen(false);
    setOpen(false);
    setViewer(null);
    setPartner(null);
    router.push("/");
    router.refresh();
  }

  function handleAnchor(href: string) {
    const id = href.replace(/^\/?#/, "");
    setOpen(false);
    if (onHome) {
      setTimeout(() => scrollToId(id), 60);
    } else {
      router.push(`/#${id}`);
    }
  }

  const isAnchor = (href?: string) => !!href && href.includes("#");
  const isStaff = viewer?.role === "staff" || viewer?.role === "admin";
  // staff book tables from the console and don't play the campaign
  const navItems = isStaff
    ? MAIN_NAV.filter((i) => i.href !== "/book" && i.href !== "/campaign")
    : MAIN_NAV;
  const cta = isStaff
    ? { href: "/admin", label: "Staff console" }
    : isPartner
      ? { href: "/partners", label: "Partner portal" }
      : { href: "/book", label: "Book a table" };

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: hidden ? -110 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        <div
          className={cn(
            "mx-auto flex items-center justify-between gap-4 px-5 transition-all duration-500 md:px-8",
            scrolled
              ? "mt-2 max-w-6xl rounded-2xl glass-strong py-2.5 shadow-[0_16px_50px_-24px_rgba(0,0,0,0.8)]"
              : "mt-0 max-w-full py-5",
          )}
        >
          <Logo compact={scrolled} />

          {/* desktop nav */}
          <nav className="hidden items-center gap-7 xl:flex">
            {navItems.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setPlayOpen(true)}
                  onMouseLeave={() => setPlayOpen(false)}
                >
                  <button
                    onClick={() => setPlayOpen((v) => !v)}
                    className="nav-link flex items-center gap-1 text-[13px] font-medium tracking-wide text-mist transition-colors hover:text-white"
                  >
                    {item.label}
                    <Chevron open={playOpen} />
                  </button>
                  <AnimatePresence>
                    {playOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-1/2 top-full w-64 -translate-x-1/2 pt-3"
                      >
                        <div className="overflow-hidden rounded-2xl border border-white/10 glass-strong p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
                          {item.children.map((c) => (
                            <DropdownLink
                              key={c.href}
                              child={c}
                              onAnchor={handleAnchor}
                              onDone={() => setPlayOpen(false)}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : item.highlight ? (
                <Link
                  key={item.label}
                  href={item.href!}
                  data-cursor="hot"
                  className="group relative inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(120deg,#ffd166,#ff9d3d)] px-4 py-1.5 text-[13px] font-bold text-navy-950 shadow-[0_10px_30px_-10px_rgba(255,157,61,0.75)] transition-transform duration-300 hover:scale-105"
                >
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-full bg-[#ff9d3d]/60 blur-md"
                    animate={{ opacity: [0.4, 0.85, 0.4] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span aria-hidden>🎮</span>
                  {item.label}
                </Link>
              ) : isAnchor(item.href) ? (
                <button
                  key={item.label}
                  onClick={() => handleAnchor(item.href!)}
                  className="nav-link text-[13px] font-medium tracking-wide text-mist transition-colors hover:text-white"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href!}
                  data-active={pathname.startsWith(item.href!) && item.href !== "/"}
                  className="nav-link text-[13px] font-medium tracking-wide text-mist transition-colors hover:text-white data-[active=true]:text-white"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          {/* right cluster */}
          <div className="hidden items-center gap-3 xl:flex">
            <AccountMenu
              viewer={viewer}
              partner={partner}
              open={acctOpen}
              setOpen={setAcctOpen}
              onSignOut={signOut}
            />
            <MagneticButton
              href={cta.href}
              className="!px-5 !py-2.5 !text-[13px]"
            >
              {cta.label}
              <Arrow />
            </MagneticButton>
          </div>

          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl glass xl:hidden"
          >
            <span className="flex flex-col gap-[5px]">
              <span className="h-[2px] w-5 bg-white" />
              <span className="h-[2px] w-5 bg-white" />
              <span className="h-[2px] w-3 bg-teal" />
            </span>
          </button>
        </div>
      </motion.header>

      {/* mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[55] xl:hidden"
          >
            <motion.div
              initial={{ clipPath: "circle(0% at 90% 6%)" }}
              animate={{ clipPath: "circle(150% at 90% 6%)" }}
              exit={{ clipPath: "circle(0% at 90% 6%)" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 bg-navy-950/96 backdrop-blur-xl"
            />
            <div className="relative flex h-full flex-col overflow-y-auto p-6">
              <div className="flex items-center justify-between">
                <Logo />
                <button
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-xl glass text-white"
                >
                  ✕
                </button>
              </div>

              {viewer && (
                <Link
                  href={
                    viewer.role === "player"
                      ? `/players/${viewer.slug}`
                      : "/admin"
                  }
                  onClick={() => setOpen(false)}
                  className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <PlayerAvatar name={viewer.fullName} size="sm" />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {viewer.nickname}
                    </span>
                    <span className="text-[11px] text-mist">
                      {viewer.role === "player"
                        ? `Rank #${viewer.rank} · ${viewer.membershipTier}`
                        : `${viewer.role} · operations console`}
                    </span>
                  </span>
                </Link>
              )}
              {isPartner && partner && (
                <Link
                  href="/partners"
                  onClick={() => setOpen(false)}
                  className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <PlayerAvatar name={partner.name} size="sm" />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {partner.name}
                    </span>
                    <span className="text-[11px] text-mist">
                      partner · {partner.canEditFinance ? "finance (edit)" : "finance (view)"}
                    </span>
                  </span>
                </Link>
              )}

              <nav className="mt-6 flex flex-col">
                {navItems.map((item, i) => (
                  <MobileNavRow
                    key={item.label}
                    item={item}
                    index={i}
                    onAnchor={handleAnchor}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </nav>

              {viewer ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-teal">
                    Your Cue Point
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {viewer.role === "player" &&
                      ACCOUNT_NAV.map((c) => (
                        <Link
                          key={c.label}
                          href={
                            c.label === "My Profile"
                              ? `/players/${viewer.slug}`
                              : c.label === "My Matches"
                                ? `/matches?player=${viewer.slug}`
                                : c.href
                          }
                          onClick={() => setOpen(false)}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white"
                        >
                          {c.label}
                        </Link>
                      ))}
                    {viewer.role !== "player" && (
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className="rounded-xl border border-teal/30 bg-teal/[0.06] px-3 py-2.5 text-sm text-teal"
                      >
                        Staff console
                      </Link>
                    )}
                    <button
                      onClick={signOut}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-mist"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : isPartner ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-teal">
                    Partner
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/partners"
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-teal/30 bg-teal/[0.06] px-3 py-2.5 text-sm text-teal"
                    >
                      Partner portal
                    </Link>
                    <button
                      onClick={signOut}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-mist"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="mt-4 block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm font-medium text-white"
                >
                  Sign in or create an account
                </Link>
              )}

              <div className="mt-auto flex flex-col gap-3 pt-6">
                <MagneticButton href={cta.href} block className="justify-center">
                  {cta.label}
                  <Arrow />
                </MagneticButton>
                <p className="text-center text-xs text-mist">
                  Pitipana, Homagama · open till late
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DropdownLink({
  child,
  onAnchor,
  onDone,
}: {
  child: { label: string; href: string; desc?: string };
  onAnchor: (href: string) => void;
  onDone: () => void;
}) {
  const anchor = child.href.includes("#");
  const body = (
    <span className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.06]">
      <span className="block text-[13px] font-medium text-white">{child.label}</span>
      {child.desc && (
        <span className="block text-[11px] text-mist">{child.desc}</span>
      )}
    </span>
  );
  if (anchor)
    return (
      <button onClick={() => onAnchor(child.href)} className="block w-full text-left">
        {body}
      </button>
    );
  return (
    <Link href={child.href} onClick={onDone} className="block">
      {body}
    </Link>
  );
}

function MobileNavRow({
  item,
  index,
  onAnchor,
  onNavigate,
}: {
  item: NavItem;
  index: number;
  onAnchor: (href: string) => void;
  onNavigate: () => void;
}) {
  const [exp, setExp] = useState(false);
  const anim = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    transition: { delay: 0.12 + index * 0.05, ease: [0.16, 1, 0.3, 1] as const },
  };

  if (item.children) {
    return (
      <motion.div {...anim} className="border-b border-white/10">
        <button
          onClick={() => setExp((v) => !v)}
          className="flex w-full items-center justify-between py-4 text-left"
        >
          <span className="font-display text-2xl font-semibold text-white">
            {item.label}
          </span>
          <Chevron open={exp} />
        </button>
        <AnimatePresence>
          {exp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-3 pl-1">
                {item.children.map((c) =>
                  c.href.includes("#") ? (
                    <button
                      key={c.href}
                      onClick={() => onAnchor(c.href)}
                      className="block py-2 text-left text-mist"
                    >
                      {c.label}
                    </button>
                  ) : (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={onNavigate}
                      className="block py-2 text-mist"
                    >
                      {c.label}
                    </Link>
                  ),
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  const cls =
    "flex items-baseline gap-4 border-b border-white/10 py-4 text-left w-full";
  const inner = item.highlight ? (
    <>
      <span aria-hidden className="text-xl">
        🎮
      </span>
      <span className="font-display text-2xl font-semibold text-[#ffb066]">
        {item.label}
      </span>
      <span className="rounded-full bg-[linear-gradient(120deg,#ffd166,#ff9d3d)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-950">
        Game world
      </span>
    </>
  ) : (
    <>
      <span className="font-mono text-xs text-teal">
        0{index + 1}
      </span>
      <span className="font-display text-2xl font-semibold text-white">
        {item.label}
      </span>
    </>
  );
  return item.href!.includes("#") ? (
    <motion.button {...anim} onClick={() => onAnchor(item.href!)} className={cls}>
      {inner}
    </motion.button>
  ) : (
    <motion.div {...anim}>
      <Link href={item.href!} onClick={onNavigate} className={cls}>
        {inner}
      </Link>
    </motion.div>
  );
}

function AccountMenu({
  viewer,
  partner,
  open,
  setOpen,
  onSignOut,
}: {
  viewer: Viewer;
  partner: Partner;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSignOut: () => void;
}) {
  if (!viewer && partner)
    return (
      <div
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 transition-colors hover:border-teal/30"
        >
          <PlayerAvatar name={partner.name} size="xs" />
          <span className="text-[13px] font-medium text-white">
            {partner.name}
          </span>
          <Chevron open={open} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-full w-60 pt-3"
            >
              <div className="overflow-hidden rounded-2xl border border-white/10 glass-strong p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
                <div className="px-3 py-2 text-[11px] text-mist">
                  Signed in as{" "}
                  <span className="text-white">{partner.name}</span> · partner
                </div>
                <Link
                  href="/partners"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 text-[13px] text-teal transition-colors hover:bg-white/[0.06]"
                >
                  Partner portal
                </Link>
                <button
                  onClick={onSignOut}
                  className="mt-1 block w-full border-t border-white/10 px-3 pb-1 pt-2 text-left text-[13px] text-mist transition-colors hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  if (!viewer)
    return (
      <Link
        href="/account"
        className="text-[13px] font-medium text-mist transition-colors hover:text-white"
      >
        Sign in
      </Link>
    );
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 transition-colors hover:border-teal/30"
      >
        <PlayerAvatar name={viewer.fullName} size="xs" />
        <span className="text-[13px] font-medium text-white">{viewer.nickname}</span>
        <Chevron open={open} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full w-60 pt-3"
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 glass-strong p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
              <div className="px-3 py-2 text-[11px] text-mist">
                Signed in as{" "}
                <span className="text-white">{viewer.nickname}</span>
                {viewer.role === "player" ? ` · #${viewer.rank}` : ` · ${viewer.role}`}
              </div>
              {viewer.role === "player" &&
                ACCOUNT_NAV.map((c) => (
                  <Link
                    key={c.label}
                    href={
                      c.label === "My Profile"
                        ? `/players/${viewer.slug}`
                        : c.label === "My Matches"
                          ? `/matches?player=${viewer.slug}`
                          : c.href
                    }
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2 text-[13px] text-white transition-colors hover:bg-white/[0.06]"
                  >
                    {c.label}
                  </Link>
                ))}
              {viewer.role !== "player" && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 text-[13px] text-teal transition-colors hover:bg-white/[0.06]"
                >
                  Staff console
                </Link>
              )}
              <button
                onClick={onSignOut}
                className="mt-1 block w-full border-t border-white/10 px-3 pb-1 pt-2 text-left text-[13px] text-mist transition-colors hover:text-white"
              >
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.2 }}
      aria-hidden
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

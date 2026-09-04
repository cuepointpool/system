/* Business + venue configuration for Cue Point */

export const SITE = {
  name: "Cue Point",
  tagline: "Where every shot counts",
  kicker: "Pool Parlour",
  /** Canonical origin — override with NEXT_PUBLIC_SITE_URL once a custom
   *  domain is live; today the site is served from CloudFront. */
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://d2tisxlomg8f7u.cloudfront.net",
  description:
    "Cue Point is a premium pool parlour in Pitipana, Homagama — tournament-grade tables, a neon-lit lounge, and an effortless online booking system.",
  address: {
    line1: "Pitipana",
    line2: "Homagama",
    region: "Western Province",
    postalCode: "10200",
    country: "Sri Lanka",
    geo: { lat: 6.8449, lng: 80.0028 },
    maps: "https://www.google.com/maps/search/?api=1&query=Pitipana+Homagama",
  },
  phone: "+94 77 026 2675",
  phoneHref: "tel:+94770262675",
  email: "play@cuepoint.lk",
  socials: {
    instagram: "https://instagram.com",
    facebook: "https://facebook.com",
    tiktok: "https://tiktok.com",
  },
} as const;

/** Opening hours, per weekday index (0 = Sun ... 6 = Sat). 24h strings;
 *  a close past midnight is written as 24:00+ (e.g. "26:00" = 2 AM next day). */
export const HOURS: { open: string; close: string }[] = [
  { open: "12:00", close: "26:00" }, // Sun — 12 PM – 2 AM
  { open: "12:00", close: "26:00" }, // Mon
  { open: "12:00", close: "26:00" }, // Tue
  { open: "12:00", close: "26:00" }, // Wed
  { open: "12:00", close: "26:00" }, // Thu
  { open: "12:00", close: "26:00" }, // Fri
  { open: "12:00", close: "26:00" }, // Sat
];

export const HOURS_DISPLAY = [
  { day: "Every day", short: "Every day", time: "12 noon – 2:00 AM" },
];

/** homepage section anchors — used for in-page scroll-spy on "/" */
export const NAV_LINKS = [
  { label: "Story", href: "#story" },
  { label: "Experience", href: "#experience" },
  { label: "Tables", href: "#tables" },
  { label: "Gallery", href: "#gallery" },
  { label: "Visit", href: "#visit" },
] as const;

export type NavChild = { label: string; href: string; desc?: string };
export type NavItem =
  | { label: string; href: string; children?: undefined; highlight?: boolean }
  | { label: string; href?: undefined; children: NavChild[]; highlight?: undefined };

/** primary site navigation (header). `highlight` gets its own gradient pill
 *  treatment in the Navbar instead of the plain text-link style — used to
 *  call out the Campaign game world so it doesn't get buried in a dropdown. */
export const MAIN_NAV: NavItem[] = [
  { label: "Book a Table", href: "/book" },
  { label: "Campaign", href: "/campaign", highlight: true },
  {
    label: "Play",
    children: [
      { label: "Rankings", href: "/rankings", desc: "The Cue Point leaderboard" },
      { label: "Players", href: "/players", desc: "Meet the community" },
      { label: "Matches", href: "/matches", desc: "Every recorded frame" },
      { label: "Tables & rates", href: "/#tables", desc: "What's on the floor" },
    ],
  },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Membership", href: "/membership" },
  { label: "Offers", href: "/offers" },
  { label: "About", href: "/#story" },
];

/** shown in the account menu when a player identity is active */
export const ACCOUNT_NAV: NavChild[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Profile", href: "/dashboard" }, // resolved to /players/<slug> in the UI
  { label: "Campaign", href: "/campaign" },
  { label: "My Matches", href: "/matches" },
  { label: "Rewards", href: "/dashboard#loyalty" },
];

export const STATS = [
  { value: 3, suffix: "", label: "Tables on the floor" },
  { value: 5, suffix: "+", label: "Years in the game" },
  { value: 40, suffix: "+", label: "Tournaments hosted" },
  { value: 8000, suffix: "+", label: "Frames racked" },
] as const;

/** Flat hourly rate — every table, standard floor or VIP booth.
 *  The floor tables themselves live in the DB (`venue_tables`, seeded by
 *  scripts/setup.ts) and are managed from the admin console. */
export const TABLE_HOURLY_RATE = 800;

/** Rate for a single 30-minute block. Booking a full hour (LKR 800) is
 *  cheaper than two half-hours, so the half-hour option is for quick frames. */
export const TABLE_HALF_HOUR_RATE = 500;

export const FEATURES = [
  {
    n: "01",
    title: "Premium Tables",
    body: "9ft match tables with Simonis-grade cloth, tournament balls and levelled slate beds. Re-clothed every quarter.",
    icon: "diamond",
    image: "/media/feature-tables.png",
    alt: "9ft match table racked under low light at Cue Point",
  },
  {
    n: "02",
    title: "Competitive Play",
    body: "Weekly ladders, handicap leagues and monthly cash tournaments with a live bracket board and ranked profiles.",
    icon: "trophy",
    image: "/media/feature-compete.png",
    alt: "Player breaking a rack beside the Cue Point live bracket screen",
  },
  {
    n: "03",
    title: "Friends & Hangouts",
    body: "Private booths, a full espresso & mocktail bar and a sound system tuned low enough to still call your shots.",
    icon: "people",
    image: "/media/feature-social.png",
    alt: "Leather booth and cocktail bar in the Cue Point lounge",
  },
  {
    n: "04",
    title: "Fun & Entertainment",
    body: "Trick-shot nights, coaching clinics with certified refs, and a rookie corner so first-timers never feel lost.",
    icon: "bolt",
    image: "/media/feature-fun.png",
    alt: "Eight ball and cue on a Cue Point table",
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "The cloth runs true and the lighting is flawless. It's the only room in Homagama I'll play a money frame in.",
    name: "Dinuka R.",
    role: "League regular",
  },
  {
    quote:
      "Booked a booth for eight, walked in, table was racked and waiting. The whole night just flowed.",
    name: "Sahan & crew",
    role: "Friday hangout",
  },
  {
    quote:
      "Started as a total beginner at the rookie corner. Three months later I'm in the Tuesday ladder. Class staff.",
    name: "Ishara P.",
    role: "Rookie ladder",
  },
] as const;

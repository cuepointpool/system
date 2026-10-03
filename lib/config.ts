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
    "Cue Point is a pool parlour in Pitipana, Homagama with three full-size 9ft tables, player rankings, tournaments and online table booking.",
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

/** Full-screen "opening soon" notice shown once per visit. Set `enabled`
 *  to false when the parlour opens. `openingDate` is optional free text
 *  (e.g. "Saturday, 11 October") — leave it empty to show no date. */
export const OPENING_NOTICE = {
  enabled: true,
  headline: "We're opening soon",
  message:
    "Cue Point is getting ready to open its doors in Pitipana, Homagama. Book your table now and be one of the first to play.",
  openingDate: "",
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
  | {
      label: string;
      href: string;
      children?: undefined;
      highlight?: boolean;
      /** which highlight colour: default gold (Campaign), or violet (Friends) */
      accent?: "friends";
    }
  | { label: string; href?: undefined; children: NavChild[]; highlight?: undefined };

/** primary site navigation (header). `highlight` gets its own gradient pill
 *  treatment in the Navbar instead of the plain text-link style — used to
 *  call out the Campaign game world so it doesn't get buried in a dropdown. */
export const MAIN_NAV: NavItem[] = [
  { label: "Book a Table", href: "/book" },
  { label: "Campaign", href: "/campaign", highlight: true },
  { label: "Friends", href: "/play", highlight: true, accent: "friends" },
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
  { label: "Play with friends", href: "/play" },
  { label: "My Matches", href: "/matches" },
  { label: "Rewards", href: "/dashboard#loyalty" },
];

/** Flat hourly rate — every table, standard floor or VIP booth.
 *  The floor tables themselves live in the DB (`venue_tables`, seeded by
 *  scripts/setup.ts) and are managed from the admin console. */
export const TABLE_HOURLY_RATE = 800;

/** Rate for a single 30-minute block. Booking a full hour (LKR 800) is
 *  cheaper than two half-hours, so the half-hour option is for quick frames. */
export const TABLE_HALF_HOUR_RATE = 500;

export const FEATURES = [
  {
    title: "Proper 9ft Tables",
    body: "Three full-size 9ft tables, one of them in a private booth. Every table plays the same and costs the same.",
    image: "/media/story/why-tables.jpg",
    alt: "A 9ft pool table under a hanging lamp",
    focus: "50% 60%",
    href: "/#boards",
    cta: "See the tables",
  },
  {
    title: "Real Competition",
    body: "Ranked matches count toward a public leaderboard and your player profile. House tournaments run on a live bracket.",
    image: "/media/story/why-compete.jpg",
    alt: "A player down on a shot",
    focus: "50% 50%",
    href: "/rankings",
    cta: "See the rankings",
  },
  {
    title: "Nights With Friends",
    body: "Bring your own crowd, set up games or a full tournament between yourselves and settle it on the table.",
    image: "/media/story/why-friends.jpg",
    alt: "A group of friends around a pool table",
    focus: "45% 50%",
    href: "/play",
    cta: "Play with friends",
  },
  {
    title: "Campaign Mode",
    body: "100 missions to work through on your phone, from your first clean break to full table control.",
    image: "/media/story/why-campaign.jpg",
    alt: "Hands racking the balls for a new frame",
    focus: "60% 50%",
    href: "/campaign",
    cta: "Start the campaign",
  },
] as const;


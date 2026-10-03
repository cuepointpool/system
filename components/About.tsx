import Link from "next/link";
import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { StoryRail } from "@/components/StoryRail";
import { TABLE_HOURLY_RATE } from "@/lib/config";
import { SectionKicker } from "@/components/BrandMark";

/* ======================================================================== */
/*  "The Cue Point story" — six photo cards covering what the parlour does:  */
/*  rankings · the room · tournaments · friend games · friend tournaments ·  */
/*  booking. /media/venue = real Cue Point photos, /media/story = stock placeholders.  */
/* ======================================================================== */

type Card = {
  title: string;
  body: string;
  cta: string;
  href: string;
  image: string;
  alt: string;
  /** object-position for the crop */
  focus?: string;
};

const CARDS: Card[] = [
  {
    title: "Play. Win. Climb the Ranks",
    body: "Every ranked frame moves your rating. Hold your spot, chase the player above you and let the board do the talking.",
    cta: "View rankings",
    href: "/rankings",
    image: "/media/story/ranks.jpg",
    alt: "A player lining up a shot on the cue ball",
    focus: "50% 40%",
  },
  {
    title: "Three 9ft Tables, One Room",
    body: "Full-size tables, tournament cloth and space for a proper stroke on every side. A room built to be played in.",
    cta: "Explore the room",
    href: "/#gallery",
    image: "/media/venue/wall-art.jpg",
    alt: "Framed pool photographs on the wall at Cue Point",
    focus: "60% 40%",
  },
  {
    title: "Tournaments & Events",
    body: "House tournaments on a live bracket. Sign up, follow your draw from your phone and play for the top spot.",
    cta: "View schedule",
    href: "/tournaments",
    image: "/media/story/tournaments.jpg",
    alt: "A player stretching over the table for a shot in a busy pool hall",
    focus: "50% 45%",
  },
  {
    title: "Game Night With Friends",
    body: "Set up an 8-Ball game, invite your friends and keep score. Both sides confirm the result, and wins count toward the Friends League.",
    cta: "Start a game",
    href: "/play/new-game",
    image: "/media/story/friends.jpg",
    alt: "Friends breaking off a rack of pool balls",
    focus: "50% 35%",
  },
  {
    title: "Run Your Own Tournament",
    body: "Bring 3 to 32 entries, singles or doubles. We draw the bracket, you run the night and everyone follows it live.",
    cta: "Create a tournament",
    href: "/play/new-tournament",
    image: "/media/story/host.jpg",
    alt: "A group of players gathered around the tables",
    focus: "35% 50%",
  },
  {
    title: `One Flat Rate: LKR ${TABLE_HOURLY_RATE} an Hour`,
    body: "Same price on every table, booth included. Pick your table and time online and it is racked and waiting when you walk in.",
    cta: "Book a table",
    href: "/book",
    image: "/media/venue/neon-sign.jpg",
    alt: "The Cue Point Pool Parlour neon sign",
    focus: "50% 15%",
  },
];

export function About() {
  return (
    <section id="story" className="overflow-hidden bg-navy-950 py-20 sm:py-28">
      <div className="px-5 md:px-8 lg:px-12">
        <Reveal>
          <SectionKicker>
            The Cue Point story
          </SectionKicker>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h2 className="font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl lg:whitespace-nowrap">
              More than a table for an hour
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-mist lg:pb-1 lg:text-right">
              Cue Point is a pool parlour in Pitipana, Homagama. Come in for a
              quiet frame, a ranked match or a full night with your own crowd.
            </p>
          </div>
        </Reveal>

        <StoryRail>
          {CARDS.map((card) => (
            <div
              key={card.href}
              className="w-[82%] flex-none snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
            >
              <StoryCard card={card} />
            </div>
          ))}
        </StoryRail>
      </div>
    </section>
  );
}

function StoryCard({ card }: { card: Card }) {
  return (
    <article className="group relative flex h-full min-h-[460px] flex-col justify-end overflow-hidden rounded-lg bg-navy-900 sm:min-h-[520px] lg:min-h-[600px] 2xl:min-h-[680px]">
      <Image
        src={card.image}
        alt={card.alt}
        fill
        sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
        style={{ objectPosition: card.focus }}
        draggable={false}
        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-navy-950 via-navy-950/85 to-transparent" />

      <div className="relative max-w-xl p-6 sm:p-7 lg:p-9">
        <h3 className="font-display text-2xl font-bold leading-tight text-gold lg:text-[2rem]">
          {card.title}
        </h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-white/90 lg:text-base">
          {card.body}
        </p>
        <Link
          href={card.href}
          className="mt-5 inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
        >
          {card.cta}
        </Link>
      </div>
    </article>
  );
}

import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { About } from "@/components/About";
import { Experience } from "@/components/Experience";
import { Boards } from "@/components/Boards";
import { Pricing } from "@/components/Pricing";
import { Tables } from "@/components/Tables";
import { Stats } from "@/components/Stats";
import { Gallery } from "@/components/Gallery";
import { Testimonials } from "@/components/Testimonials";
import { BookingSection } from "@/components/BookingSection";
import { Location } from "@/components/Location";
import { HomeScene, HomeOffersCommunity } from "@/components/eco/HomeSections";
import { listTables } from "@/lib/tables";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tables = (await listTables()).map((t) => ({
    id: t.id,
    label: t.label,
    area: t.area,
    note: t.note,
    seats: t.seats,
    bookable: t.bookable,
  }));

  return (
    <>
      <Hero />
      <Marquee />
      <About />
      <Experience />
      <Boards />
      <Pricing />
      <Tables tables={tables} />
      <Stats />
      <HomeScene />
      <Gallery />
      <HomeOffersCommunity />
      <Testimonials />
      <BookingSection tables={tables} />
      <Location />
    </>
  );
}

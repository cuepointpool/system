import type { Metadata } from "next";
import { PartnerPortal } from "@/components/eco/PartnerPortal";

export const metadata: Metadata = {
  title: "Partner portal",
  robots: { index: false },
};

export default function PartnersPage() {
  return <PartnerPortal />;
}

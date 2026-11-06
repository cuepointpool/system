import type { Metadata } from "next";
import { ClubPortal } from "@/components/clubs/ClubPortal";

export const metadata: Metadata = {
  title: "Club admin",
  robots: { index: false, follow: false },
};

export default function ClubAdminPage() {
  return <ClubPortal />;
}

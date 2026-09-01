import type { Metadata } from "next";
import { AdminConsole } from "@/components/eco/AdminConsole";

export const metadata: Metadata = {
  title: "Staff console",
  robots: { index: false },
};

export default function AdminPage() {
  return <AdminConsole />;
}

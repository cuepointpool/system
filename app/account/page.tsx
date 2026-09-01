import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/ecosystem/identity";
import { countPlayers } from "@/lib/ecosystem/store";
import { AccountForm } from "@/components/eco/AccountForm";
import { PageHero } from "@/components/eco/Primitives";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Cue Point player account, or create one.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer) redirect("/dashboard");

  const sp = await searchParams;
  const firstEver = (await countPlayers()) === 0;

  return (
    <>
      <PageHero
        kicker="Cue Point account"
        title={
          firstEver ? (
            <>
              Set up <span className="text-teal-gradient">Cue Point</span>
            </>
          ) : (
            <>
              Your Cue Point <span className="text-teal-gradient">identity</span>
            </>
          )
        }
        intro={
          firstEver
            ? "No accounts yet — the first one you create becomes the admin, with access to the staff console."
            : "One account tracks your bookings, stats, ranking, tournaments and loyalty."
        }
      />
      <section className="mx-auto max-w-md px-5 pb-28 md:px-8">
        <AccountForm
          initialMode={sp.mode === "join" || firstEver ? "join" : "signin"}
          nextPath={sp.next ?? "/dashboard"}
          firstEver={firstEver}
        />
      </section>
    </>
  );
}

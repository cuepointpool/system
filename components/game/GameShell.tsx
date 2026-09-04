import { BottomNavigation, SideNavigation } from "./BottomNavigation";
import { MobileTopBar } from "./MobileTopBar";
import { CampaignImage } from "./CampaignImage";

/**
 * The frame every game screen sits in: fixed top bar, scrolling content
 * padded clear of both bars, bottom nav on mobile / left rail on desktop.
 */
export function GameShell({
  title,
  coins,
  level,
  playerName,
  avatar,
  back,
  backdrop,
  backdropFocus,
  children,
}: {
  title: string;
  coins: number;
  level: number;
  playerName: string;
  avatar?: string | null;
  back?: string;
  /** ambient artwork behind the whole screen */
  backdrop?: string;
  backdropFocus?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen lg:pl-60">
      {backdrop && (
        <div className="pointer-events-none fixed inset-0 -z-10">
          <CampaignImage
            src={backdrop}
            focus={backdropFocus ?? "50% 30%"}
            alt=""
            className="absolute inset-0 h-full w-full"
            sizes="100vw"
          />
          {/* heavy scrim — the artwork is atmosphere, never competition for
              the content sitting on top of it */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,28,0.93)_0%,rgba(5,16,28,0.88)_40%,rgba(5,16,28,0.96)_100%)]" />
        </div>
      )}
      <MobileTopBar
        title={title}
        coins={coins}
        level={level}
        playerName={playerName}
        avatar={avatar}
        back={back}
      />
      <SideNavigation />
      <div className="mx-auto max-w-3xl px-4 pb-nav pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:max-w-5xl lg:pb-16">
        {children}
      </div>
      <BottomNavigation />
    </div>
  );
}

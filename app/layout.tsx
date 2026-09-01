import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Cursor } from "@/components/Cursor";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SITE } from "@/lib/config";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cuepoint.lk"),
  title: {
    default: `${SITE.name} — Pool Parlour in Pitipana, Homagama`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "pool parlour",
    "billiards Homagama",
    "VIP pool table Pitipana",
    "book pool table Sri Lanka",
    "Cue Point",
  ],
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    type: "website",
    locale: "en_LK",
    images: [{ url: "/media/cover.png", width: 2031, height: 774, alt: SITE.name }],
  },
  icons: {
    icon: [{ url: "/media/logo-mark.png" }],
    apple: [{ url: "/media/logo-mark.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#05101c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} antialiased`}>
      <body className="min-h-screen">
        <SmoothScroll>
          <ScrollProgress />
          <Cursor />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}

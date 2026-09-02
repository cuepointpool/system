import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Cursor } from "@/components/Cursor";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Analytics } from "@/components/Analytics";
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
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Book a Pool Table in Pitipana, Homagama`,
    template: `%s · ${SITE.name} Pool Parlour`,
  },
  description: SITE.description,
  keywords: [
    "pool parlour Homagama",
    "book a pool table Pitipana",
    "billiards Sri Lanka",
    "VIP pool table booking",
    "9ft King Model tables",
    "Cue Point",
  ],
  openGraph: {
    title: `${SITE.name} — Book a Pool Table in Homagama`,
    description: SITE.description,
    url: SITE.url,
    siteName: `${SITE.name} Pool Parlour`,
    type: "website",
    locale: "en_LK",
    images: [{ url: "/media/cover.png", width: 2031, height: 774, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Book a Pool Table in Homagama`,
    description: SITE.description,
    images: ["/media/cover.png"],
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
        <Analytics />
      </body>
    </html>
  );
}

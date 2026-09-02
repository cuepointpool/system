import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/book", priority: 0.9, freq: "daily" },
    { path: "/membership", priority: 0.7, freq: "monthly" },
    { path: "/offers", priority: 0.7, freq: "weekly" },
    { path: "/rankings", priority: 0.6, freq: "daily" },
    { path: "/players", priority: 0.5, freq: "daily" },
    { path: "/matches", priority: 0.5, freq: "daily" },
    { path: "/tournaments", priority: 0.6, freq: "weekly" },
  ];
  return routes.map((r) => ({
    url: `${SITE.url}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}

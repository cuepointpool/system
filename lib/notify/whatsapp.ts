/* ============================================================
   WhatsApp alerts to the owners when someone books online.

   Two ways to send, picked by which env vars are set (both may be):

   1. CallMeBot (free, personal alerts — each owner activates their own
      number once by messaging the CallMeBot WhatsApp number):
        CALLMEBOT_KEYS="94770262675:1234567,94785262675:7654321"

   2. WhatsApp Cloud API (Meta, official). Messages to people who haven't
      written to the business in 24h must use an approved template whose
      body has ONE variable ({{1}}) for the booking summary:
        WHATSAPP_TOKEN=...            permanent system-user token
        WHATSAPP_PHONE_ID=...         sender phone-number id
        WHATSAPP_TO="94770262675,94785262675"
        WHATSAPP_TEMPLATE=new_booking (optional; default new_booking)
        WHATSAPP_TEMPLATE_LANG=en     (optional)

   Sending never blocks or fails a booking: errors are logged and noted
   in the audit trail.
   ============================================================ */

import type { Booking } from "../booking";
import { audit } from "../ecosystem/store";
import { formatLKR, label12h, minutesToTime, timeToMinutes } from "../utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function niceDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]} ${day} ${MONTHS[m - 1]}`;
}

function hoursLabel(h: number): string {
  const whole = Math.floor(h);
  const half = h - whole >= 0.5;
  return whole === 0 ? "30 min" : half ? `${whole}h 30m` : `${whole}h`;
}

/** One-line summary (template variables can't contain line breaks). */
export function bookingSummary(b: Booking): string {
  const end = minutesToTime((timeToMinutes(b.startTime) + Math.round(b.durationHrs * 60)) % 1440);
  const parts = [
    `${b.tableName}`,
    `${niceDate(b.date)}, ${label12h(b.startTime)} – ${label12h(end)} (${hoursLabel(b.durationHrs)})`,
    `${b.customerName}${b.phone ? ` ${b.phone}` : ""}`,
    `${b.partySize} ${b.partySize === 1 ? "player" : "players"}`,
    formatLKR(b.totalAmount),
    `Ref ${b.reference}`,
  ];
  if (b.notes?.trim()) parts.push(`Note: ${b.notes.trim().replace(/\s+/g, " ").slice(0, 200)}`);
  return parts.join(" · ");
}

/** Free-text message for CallMeBot. */
function bookingMessage(b: Booking): string {
  return `🎱 New online booking — Cue Point\n${bookingSummary(b).split(" · ").join("\n")}`;
}

async function viaCallMeBot(text: string): Promise<string[]> {
  const raw = process.env.CALLMEBOT_KEYS ?? "";
  const pairs = raw
    .split(",")
    .map((p) => p.trim().split(":"))
    .filter(([phone, key]) => phone && key);
  const failed: string[] = [];
  for (const [phone, key] of pairs) {
    const url =
      `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
      `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      const body = await res.text();
      if (!res.ok || /error|invalid/i.test(body.slice(0, 300))) failed.push(`${phone}: ${res.status}`);
    } catch (e) {
      failed.push(`${phone}: ${e instanceof Error ? e.message : "network"}`);
    }
  }
  return failed;
}

async function viaCloudApi(summary: string): Promise<string[]> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const to = (process.env.WHATSAPP_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || !phoneId || !to.length) return [];
  const failed: string[] = [];
  for (const number of to) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "template",
          template: {
            name: process.env.WHATSAPP_TEMPLATE || "new_booking",
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
            components: [{ type: "body", parameters: [{ type: "text", text: summary.slice(0, 1000) }] }],
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) failed.push(`${number}: ${res.status} ${(await res.text()).slice(0, 160)}`);
    } catch (e) {
      failed.push(`${number}: ${e instanceof Error ? e.message : "network"}`);
    }
  }
  return failed;
}

export const whatsappConfigured = () =>
  !!process.env.CALLMEBOT_KEYS || !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TO);

/** Tell the owners about a new online booking. Never throws. */
export async function notifyNewBooking(b: Booking): Promise<void> {
  if (!whatsappConfigured()) return;
  try {
    const failed = [...(await viaCallMeBot(bookingMessage(b))), ...(await viaCloudApi(bookingSummary(b)))];
    if (failed.length) {
      console.error("whatsapp booking alert failed", b.reference, failed);
      await audit("system", "notify.whatsapp.fail", "booking", b.id, failed.join(" | ").slice(0, 500));
    }
  } catch (e) {
    console.error("whatsapp booking alert error", e);
  }
}

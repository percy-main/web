import { schedule } from "@netlify/functions";

/**
 * Netlify scheduled function that fires every Thursday at 18:00 UK time.
 *
 * Cron: "0 18 * * 4" — 18:00 UTC Thursday (close enough; UK is UTC or UTC+1).
 * During BST this fires at 19:00 UK time, which is still fine for a reminder.
 *
 * This triggers the fantasy reminder API endpoint which:
 * 1. Finds participants who haven't made changes this gameweek
 * 2. Sends reminder emails to each of them
 */
export const handler = schedule("0 18 * * 4", async () => {
  const siteUrl = process.env.DEPLOY_PRIME_URL ?? process.env.URL;
  const secret = process.env.SYNC_SECRET;

  if (!siteUrl || !secret) {
    console.error("Missing DEPLOY_PRIME_URL/URL or SYNC_SECRET env vars");
    return { statusCode: 500 };
  }

  const url = `${siteUrl}/api/fantasy-reminder`;
  console.log(`Triggering fantasy reminder at ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });

    const body = await res.text();
    console.log(`Reminder response: ${res.status} — ${body}`);
  } catch (err) {
    console.error("Failed to trigger fantasy reminder:", err);
  }

  return { statusCode: 200 };
});

import { schedule } from "@netlify/functions";

// Thin cron trigger — fires a POST to the Astro API endpoint which does the actual work.
// The API endpoint uses waitUntil() to run the sync after responding 202.
export const handler = schedule("0 3 * * 0,5", async () => {
  // Use DEPLOY_PRIME_URL (Netlify deploy URL) to bypass WAF on the custom domain
  const siteUrl = process.env.DEPLOY_PRIME_URL ?? process.env.URL;
  const secret = process.env.SYNC_SECRET;

  if (!siteUrl || !secret) {
    console.error("Missing URL or SYNC_SECRET env vars");
    return { statusCode: 500 };
  }

  console.log(`Triggering sync at ${siteUrl}/api/sync-play-cricket-stats`);

  try {
    const res = await fetch(`${siteUrl}/api/sync-play-cricket-stats`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });

    console.log(`Trigger response: ${res.status}`);
  } catch (err) {
    console.error("Failed to trigger sync:", err);
  }

  return { statusCode: 200 };
});

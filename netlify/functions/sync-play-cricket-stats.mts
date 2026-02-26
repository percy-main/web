import { schedule } from "@netlify/functions";

// Thin cron trigger — invokes the background function which gets 15 minutes.
export const handler = schedule("0 3 * * 0,5", async () => {
  const siteUrl = process.env.DEPLOY_PRIME_URL ?? process.env.URL;
  const secret = process.env.SYNC_SECRET;

  if (!siteUrl || !secret) {
    console.error("Missing DEPLOY_PRIME_URL/URL or SYNC_SECRET env vars");
    return { statusCode: 500 };
  }

  const url = `${siteUrl}/.netlify/functions/do-sync-play-cricket-background`;
  console.log(`Triggering background sync at ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });

    console.log(`Trigger response: ${res.status}`);
  } catch (err) {
    console.error("Failed to trigger sync:", err);
  }

  return { statusCode: 200 };
});

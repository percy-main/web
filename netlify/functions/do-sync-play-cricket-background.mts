import type { Handler } from "@netlify/functions";
import { runSync } from "../../src/lib/play-cricket/sync.js";

// Background function — gets 15 minutes of execution time.
// Invoked by the cron function or manually via POST.
export const handler: Handler = async (event) => {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    console.error("SYNC_SECRET not configured");
    return { statusCode: 500, body: "SYNC_SECRET not configured" };
  }

  // Cron invocations come via the scheduled function with the secret.
  // Manual invocations must include the Authorization header.
  const auth = event.headers.authorization;
  if (auth !== `Bearer ${secret}`) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const apiKey = process.env.PLAY_CRICKET_API_KEY;
  const siteId = process.env.PLAY_CRICKET_SITE_ID;
  const dbUrl = process.env.DB_SYNC_URL;
  const dbToken = process.env.DB_TOKEN;

  if (!apiKey || !siteId || !dbUrl || !dbToken) {
    console.error("Missing required env vars");
    return { statusCode: 500, body: "Missing env vars" };
  }

  try {
    const result = await runSync({
      apiKey,
      siteId,
      dbUrl,
      dbToken,
      // Temporarily sync all historical seasons (2000-2025) for all-time leaderboards.
      // Current year (2026) is automatically included by runSync.
      // Revert to [] after historical sync completes successfully.
      extraSeasons: Array.from({ length: 26 }, (_, i) => 2000 + i),
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Sync failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};

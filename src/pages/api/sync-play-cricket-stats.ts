export const prerender = false;

import { runSync } from "@/lib/play-cricket/sync";
import type { APIContext } from "astro";
import {
  DB_SYNC_URL,
  DB_TOKEN,
  PLAY_CRICKET_API_KEY,
  PLAY_CRICKET_SITE_ID,
} from "astro:env/server";

export async function POST({ request, locals }: APIContext): Promise<Response> {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return new Response("SYNC_SECRET not configured", { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!DB_SYNC_URL || !DB_TOKEN) {
    return new Response("DB not configured", { status: 500 });
  }

  // Fire off the sync in the background via waitUntil, respond immediately
  const syncPromise = runSync({
    apiKey: PLAY_CRICKET_API_KEY,
    siteId: PLAY_CRICKET_SITE_ID,
    dbUrl: DB_SYNC_URL,
    dbToken: DB_TOKEN,
    // TODO: remove 2025 after first successful sync
    extraSeasons: [2025],
  });

  // Use Netlify's waitUntil to run the sync after responding
  const netlifyContext = (locals as Record<string, unknown>).netlify as
    | { context?: { waitUntil?: (p: Promise<unknown>) => void } }
    | undefined;

  if (netlifyContext?.context?.waitUntil) {
    netlifyContext.context.waitUntil(syncPromise);
    return new Response(JSON.stringify({ status: "accepted" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fallback: run inline (local dev or no waitUntil support)
  try {
    const result = await syncPromise;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const prerender = false;

import { client } from "@/lib/db/client";
import { send } from "@/lib/email/send";
import {
  getCurrentGameweek,
  getCurrentSeason,
  isPreSeason,
} from "@/lib/fantasy/gameweek";
import type { APIContext } from "astro";
import { render } from "@react-email/components";
import { FantasyReminder } from "../../../emails/FantasyReminder";
import { sql } from "kysely";

/**
 * API endpoint called by the Netlify scheduled function on Thursday evenings.
 * Sends reminder emails to fantasy participants who haven't made changes this gameweek.
 */
export async function POST({ request }: APIContext): Promise<Response> {
  // Authenticate via SYNC_SECRET (same as other internal endpoints)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const secret: string | undefined = import.meta.env.SYNC_SECRET ?? process.env.SYNC_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const currentSeason = getCurrentSeason();

  if (isPreSeason(currentSeason)) {
    return new Response(
      JSON.stringify({ sent: 0, message: "Pre-season, no reminders needed" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const gameweek = getCurrentGameweek(currentSeason);

  // Get all teams with owner info
  const teams = await client
    .selectFrom("fantasy_team as ft")
    .innerJoin("user as u", "u.id", "ft.user_id")
    .where("ft.season", "=", currentSeason)
    .select(["ft.id", "u.name", "u.email"])
    .execute();

  const siteUrl = import.meta.env.BASE_URL ?? process.env.URL ?? "https://percymain.org";
  const imageBaseUrl = `${siteUrl}/images`;
  let sent = 0;

  for (const team of teams) {
    // Check if this user has made any changes this gameweek
    const changes = await client
      .selectFrom("fantasy_team_player")
      .where("fantasy_team_id", "=", team.id ?? 0)
      .where("gameweek_added", "=", gameweek)
      .select(sql<number>`COUNT(*)`.as("count"))
      .executeTakeFirst();

    if ((changes?.count ?? 0) > 0) {
      continue; // User has been active, skip
    }

    try {
      const html = await render(
        FantasyReminder.component({
          imageBaseUrl,
          name: team.name ?? "there",
          gameweek,
          fantasyUrl: `${siteUrl}/members/fantasy`,
        }),
      );

      await send({
        to: team.email,
        subject: FantasyReminder.subject,
        html,
      });

      sent++;
    } catch (err) {
      console.error(`Failed to send reminder to ${team.email}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ sent, total: teams.length, gameweek }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

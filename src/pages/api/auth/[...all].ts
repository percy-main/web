import { auth } from "@/lib/auth/server";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async (ctx) => {
  return auth.handler(ctx.request);
};

export const prerender = false;

import { auth } from "@/lib/auth/server";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async (context) => {
  const isAuthed = await auth.api.getSession({
    headers: context.request.headers,
  });

  if (isAuthed) {
    context.locals.user = isAuthed.user;
    context.locals.session = isAuthed.session;
  } else {
    context.locals.user = null;
    context.locals.session = null;
  }

  return auth.handler(context.request);
};

import { auth } from "@/lib/auth/server";
import { getReceiptImage } from "@/lib/blobs";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const key = params.key;
  if (!key || !/^[a-f0-9-]+$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  const result = await getReceiptImage(key);
  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(result.data, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
};

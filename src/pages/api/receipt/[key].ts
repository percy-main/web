import { getReceiptImage } from "@/lib/blobs";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

const STORE_NAME = "receipts";
const LOCAL_DIR = ".data/receipts";

const metaSchema = z.object({
  contentType: z.string().optional(),
});

/**
 * Check if Netlify Blobs environment context is available.
 * The `getStore()` call requires NETLIFY_BLOBS_CONTEXT to be set.
 */
function hasBlobContext(): boolean {
  return !!(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    globalThis.netlifyBlobsContext ??
    process.env.NETLIFY_BLOBS_CONTEXT
  );
}

/**
 * Convert a Uint8Array to a proper ArrayBuffer (not SharedArrayBuffer).
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

/**
 * Store a receipt image. Returns the URL to access the image.
 *
 * - When Netlify Blobs context is available: stores in blob storage,
 *   returns `/api/receipt/<key>`.
 * - When running locally: stores on filesystem, returns `/api/receipt/<key>`.
 * - Otherwise (e.g. deploy preview without blob context): returns null,
 *   signalling the caller should store the data URL directly in the DB.
 */
export async function storeReceiptImage(
  imageBytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const key = randomUUID();

  if (hasBlobContext()) {
    const store = getStore(STORE_NAME);
    await store.set(key, toArrayBuffer(imageBytes), {
      metadata: { contentType },
    });
    return `/api/receipt/${key}`;
  }

  // Local dev: store on filesystem
  if (!process.env.NETLIFY) {
    if (!existsSync(LOCAL_DIR)) {
      mkdirSync(LOCAL_DIR, { recursive: true });
    }
    writeFileSync(join(LOCAL_DIR, key), imageBytes);
    writeFileSync(
      join(LOCAL_DIR, `${key}.meta`),
      JSON.stringify({ contentType }),
    );
    return `/api/receipt/${key}`;
  }

  // Netlify without blob context (e.g. deploy preview): signal fallback
  return null;
}

/**
 * Retrieve a receipt image from blob storage or local filesystem.
 * Returns null if not found.
 */
export async function getReceiptImage(
  key: string,
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  if (hasBlobContext()) {
    const store = getStore(STORE_NAME);
    const blob = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!blob) return null;
    const parsed = metaSchema.safeParse(blob.metadata);
    const contentType = parsed.success
      ? (parsed.data.contentType ?? "image/jpeg")
      : "image/jpeg";
    return { data: blob.data, contentType };
  }

  // Local fallback
  const filePath = join(LOCAL_DIR, key);
  if (!existsSync(filePath)) return null;

  const fileBytes = readFileSync(filePath);
  const data = toArrayBuffer(fileBytes);
  let contentType = "image/jpeg";
  const metaPath = join(LOCAL_DIR, `${key}.meta`);
  if (existsSync(metaPath)) {
    const parsed = metaSchema.safeParse(
      JSON.parse(readFileSync(metaPath, "utf-8")),
    );
    if (parsed.success) {
      contentType = parsed.data.contentType ?? contentType;
    }
  }

  return { data, contentType };
}

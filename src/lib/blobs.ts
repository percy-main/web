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

function isNetlify(): boolean {
  return !!process.env.NETLIFY;
}

/**
 * Convert a Uint8Array to a proper ArrayBuffer (not SharedArrayBuffer).
 * Needed because Node's Buffer.buffer can be a SharedArrayBuffer.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

/**
 * Store an image in blob storage. Returns the key used to retrieve it.
 */
export async function storeReceiptImage(
  imageBytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const key = randomUUID();

  if (isNetlify()) {
    const store = getStore(STORE_NAME);
    await store.set(key, toArrayBuffer(imageBytes), {
      metadata: { contentType },
    });
  } else {
    // Local fallback: store on filesystem
    if (!existsSync(LOCAL_DIR)) {
      mkdirSync(LOCAL_DIR, { recursive: true });
    }
    writeFileSync(join(LOCAL_DIR, key), imageBytes);
    writeFileSync(
      join(LOCAL_DIR, `${key}.meta`),
      JSON.stringify({ contentType }),
    );
  }

  return key;
}

/**
 * Retrieve a receipt image from blob storage.
 * Returns null if not found.
 */
export async function getReceiptImage(
  key: string,
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  if (isNetlify()) {
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

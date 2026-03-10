import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const STORE_NAME = "receipts";
const LOCAL_DIR = ".data/receipts";

function isNetlify(): boolean {
  return !!process.env.NETLIFY;
}

/**
 * Store an image in blob storage. Returns the key used to retrieve it.
 */
export async function storeReceiptImage(
  imageBuffer: Buffer,
  contentType: string,
): Promise<string> {
  const key = randomUUID();

  if (isNetlify()) {
    const store = getStore(STORE_NAME);
    await store.set(key, imageBuffer, { metadata: { contentType } });
  } else {
    // Local fallback: store on filesystem
    if (!existsSync(LOCAL_DIR)) {
      mkdirSync(LOCAL_DIR, { recursive: true });
    }
    writeFileSync(join(LOCAL_DIR, key), imageBuffer);
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
): Promise<{ data: Buffer; contentType: string } | null> {
  if (isNetlify()) {
    const store = getStore(STORE_NAME);
    const blob = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!blob) return null;
    const contentType =
      (blob.metadata as Record<string, string>).contentType ||
      "image/jpeg";
    return { data: Buffer.from(blob.data), contentType };
  }

  // Local fallback
  const filePath = join(LOCAL_DIR, key);
  if (!existsSync(filePath)) return null;

  const data = readFileSync(filePath);
  let contentType = "image/jpeg";
  const metaPath = join(LOCAL_DIR, `${key}.meta`);
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
      contentType?: string;
    };
    contentType = meta.contentType ?? contentType;
  }

  return { data, contentType };
}

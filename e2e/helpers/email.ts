import { readdir, readFile } from "fs/promises";
import { join } from "path";

function emailDir(): string {
  return process.env.EMAIL_DIR ?? join(process.cwd(), ".emails");
}

export async function getLatestEmail(): Promise<{
  html: string;
  json: Record<string, unknown>;
}> {
  const dir = emailDir();
  const files = await readdir(dir);
  const htmlFiles = files
    .filter((f) => f.endsWith(".html"))
    .sort()
    .reverse();

  if (htmlFiles.length === 0) {
    throw new Error(`No emails found in ${dir}`);
  }

  const latest = htmlFiles[0];
  const baseName = latest.replace(".html", "");

  const html = await readFile(join(dir, `${baseName}.html`), "utf-8");
  const json = JSON.parse(
    await readFile(join(dir, `${baseName}.json`), "utf-8"),
  ) as Record<string, unknown>;

  return { html, json };
}

export function extractUrl(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  if (!match?.[0]) {
    throw new Error(`No URL matching ${pattern} found in email`);
  }
  return match[0].replace(/&amp;/g, "&");
}

export function extractVerificationUrl(html: string): string {
  return extractUrl(html, /http[s]?:\/\/[^\s"<]+\/api\/auth\/verify-email[^\s"<]*/);
}

export function extractResetUrl(html: string): string {
  return extractUrl(html, /http[s]?:\/\/[^\s"<]+\/auth\/reset-password[^\s"<]*/);
}

import { readdir, readFile, rm } from "fs/promises";
import { join } from "path";

const EMAILS_DIR = join(process.cwd(), ".emails");

export async function getLatestEmail(): Promise<{
  html: string;
  json: Record<string, unknown>;
}> {
  const files = await readdir(EMAILS_DIR);
  const htmlFiles = files
    .filter((f) => f.endsWith(".html"))
    .sort()
    .reverse();

  if (htmlFiles.length === 0) {
    throw new Error("No emails found in .emails/");
  }

  const latest = htmlFiles[0];
  const baseName = latest.replace(".html", "");

  const html = await readFile(join(EMAILS_DIR, `${baseName}.html`), "utf-8");
  const json = JSON.parse(
    await readFile(join(EMAILS_DIR, `${baseName}.json`), "utf-8"),
  );

  return { html, json };
}

export function extractUrl(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  if (!match?.[0]) {
    throw new Error(`No URL matching ${pattern} found in email`);
  }
  return match[0];
}

export function extractVerificationUrl(html: string): string {
  return extractUrl(html, /http[s]?:\/\/[^\s"<]+\/api\/auth\/verify-email[^\s"<]*/);
}

export function extractResetUrl(html: string): string {
  return extractUrl(html, /http[s]?:\/\/[^\s"<]+\/auth\/reset-password[^\s"<]*/);
}

export async function clearEmails(): Promise<void> {
  const files = await readdir(EMAILS_DIR).catch(() => []);
  await Promise.all(files.map((f) => rm(join(EMAILS_DIR, f))));
}

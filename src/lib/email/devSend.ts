import { writeFile } from "fs/promises";
import { join } from "path";
import type { Email } from "./types";

export const devSend = async ({ html, ...rest }: Email) => {
  const now = new Date().toISOString();
  await writeFile(join(process.cwd(), ".emails", `${now}.html`), html);
  await writeFile(
    join(process.cwd(), ".emails", `${now}.json`),
    JSON.stringify(rest, null, 2),
  );
};

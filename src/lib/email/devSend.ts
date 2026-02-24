import { writeFile } from "fs/promises";
import { join } from "path";
import type { Email } from "./types";

const emailDir = () =>
  process.env.EMAIL_DIR ?? join(process.cwd(), ".emails");

export const devSend = async ({ html, ...rest }: Email) => {
  const now = new Date().toISOString();
  await writeFile(join(emailDir(), `${now}.html`), html);
  await writeFile(
    join(emailDir(), `${now}.json`),
    JSON.stringify(rest, null, 2),
  );
};

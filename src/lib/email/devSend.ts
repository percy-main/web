import { writeFile } from "fs/promises";
import { join } from "path";
import type { Email } from "./types";

export const devSend = async ({ html }: Email) => {
  await writeFile(
    join(process.cwd(), ".emails", `${new Date().toISOString()}.html`),
    html,
  );
};

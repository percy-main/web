#!/bin/zx

import { $ } from "zx";
import { generateAction } from "./generate.mjs";

const filename = new Date().toISOString();

await generateAction({
  cwd: process.cwd(),
  output: `./.temp/${filename}.sql`,
  config: "./src/lib/auth/server.tsx",
});

console.log(`SQL generated to ./.temp/${filename}.sql`);

const sql = await $`cat "./.temp/${filename}.sql"`;

const migrationLines = sql
  .lines()
  .map((line) => {
    if (!line.trim()) {
      return undefined;
    }

    return line;
  })
  .filter(Boolean)
  .map(
    (line) => `await sql\`
        ${line}
    \`.execute(db);`,
  )
  .join("\n");

const kyseley_migration = `
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    ${migrationLines}
}
`;

$`echo ${kyseley_migration} >> "src/lib/db/migrations/${filename}.ts"`;

console.log(`Kysesly generated to src/lib/db/migrations/${filename}.ts`);

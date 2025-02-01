#!/bin/zx

import { $ } from "zx";
import { generateAction } from "./generate.mjs";

const filename = new Date().toISOString();

await generateAction({
  cwd: process.cwd(),
  output: `./.better-auth/${filename}.sql`,
  config: "./src/lib/auth/server.tsx",
});

console.log(`SQL generated to ./.better-auth/${filename}.sql`);

const sql = await $`cat "./.better-auth/${filename}.sql"`;

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

export async function up(db: Kysely<unknown>): Promise<void> {
    ${migrationLines}
}
`;

void $`echo ${kyseley_migration} >> "src/lib/db/migrations/${filename}.ts"`;

console.log(`Kysely generated to src/lib/db/migrations/${filename}.ts`);

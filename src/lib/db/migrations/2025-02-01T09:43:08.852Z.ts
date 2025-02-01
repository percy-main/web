
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        alter table "user" add column "twoFactorEnabled" integer;
    `.execute(db);
await sql`
        create table "twoFactor" ("id" text not null primary key, "secret" text not null, "backupCodes" text not null, "userId" text not null references "user" ("id"))
    `.execute(db);
}


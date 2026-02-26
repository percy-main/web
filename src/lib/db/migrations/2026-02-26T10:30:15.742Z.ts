import type { Kysely } from "kysely";

// No-op: UNIQUE index on member.email deferred until production duplicates are
// cleaned up via the admin merge tool. This file exists to keep migration
// history consistent with deploy-preview branch databases.
export async function up(_db: Kysely<unknown>): Promise<void> {}

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("member")
    .addColumn("id", "uuid", (col) => col.primaryKey().notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("address", "text", (col) => col.notNull())
    .addColumn("postcode", "text", (col) => col.notNull())
    .addColumn("dob", "text", (col) => col.notNull())
    .addColumn("telephone", "text", (col) => col.notNull())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("emergency_contact_name", "text", (col) => col.notNull())
    .addColumn("emergency_contact_telephone", "text", (col) => col.notNull())
    .execute();
}

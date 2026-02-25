import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("dependent")
    .addColumn("school_year", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("played_before", "integer")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("previous_cricket", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("whatsapp_consent", "integer")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("alt_contact_name", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("alt_contact_phone", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("alt_contact_whatsapp_consent", "integer")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("gp_surgery", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("gp_phone", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("has_disability", "integer")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("disability_type", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("medical_info", "text")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("emergency_medical_consent", "integer")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("medical_fitness_declaration", "integer")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("data_protection_consent", "integer")
    .execute();

  await db.schema
    .alterTable("dependent")
    .addColumn("photo_consent", "integer")
    .execute();
}

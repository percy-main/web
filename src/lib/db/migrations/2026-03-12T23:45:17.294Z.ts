import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // SQLite can't ALTER COLUMN nullability, so recreate the table
  // Disable FK checks to allow DROP TABLE with referencing tables
  await sql`PRAGMA foreign_keys = OFF`.execute(db);

  // Drop leftover temp table if a previous attempt failed partway
  await sql`DROP TABLE IF EXISTS member_new`.execute(db);

  await sql`
    CREATE TABLE member_new (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT,
      name TEXT,
      email TEXT NOT NULL,
      address TEXT,
      postcode TEXT,
      dob TEXT,
      telephone TEXT,
      emergency_contact_name TEXT,
      emergency_contact_telephone TEXT,
      member_category TEXT,
      play_cricket_id TEXT,
      stripe_customer_id TEXT,
      contentful_entry_id TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      deleted_reason TEXT
    )
  `.execute(db);

  await sql`
    INSERT INTO member_new
    SELECT id, title, name, email, address, postcode, dob, telephone,
           emergency_contact_name, emergency_contact_telephone,
           member_category, play_cricket_id, stripe_customer_id,
           contentful_entry_id, deleted_at, deleted_by, deleted_reason
    FROM member
  `.execute(db);

  await sql`DROP TABLE member`.execute(db);
  await sql`ALTER TABLE member_new RENAME TO member`.execute(db);
  await sql`PRAGMA foreign_keys = ON`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Reverse: make fields NOT NULL again (data loss possible for NULL rows)
  await sql`PRAGMA foreign_keys = OFF`.execute(db);
  await sql`DROP TABLE IF EXISTS member_new`.execute(db);

  await sql`
    CREATE TABLE member_new (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      postcode TEXT NOT NULL,
      dob TEXT NOT NULL,
      telephone TEXT NOT NULL,
      emergency_contact_name TEXT NOT NULL,
      emergency_contact_telephone TEXT NOT NULL,
      member_category TEXT,
      play_cricket_id TEXT,
      stripe_customer_id TEXT,
      contentful_entry_id TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      deleted_reason TEXT
    )
  `.execute(db);

  await sql`
    INSERT INTO member_new
    SELECT id, COALESCE(title, ''), COALESCE(name, ''), email,
           COALESCE(address, ''), COALESCE(postcode, ''),
           COALESCE(dob, ''), COALESCE(telephone, ''),
           COALESCE(emergency_contact_name, ''),
           COALESCE(emergency_contact_telephone, ''),
           member_category, play_cricket_id, stripe_customer_id,
           contentful_entry_id, deleted_at, deleted_by, deleted_reason
    FROM member
  `.execute(db);

  await sql`DROP TABLE member`.execute(db);
  await sql`ALTER TABLE member_new RENAME TO member`.execute(db);
  await sql`PRAGMA foreign_keys = ON`.execute(db);
}

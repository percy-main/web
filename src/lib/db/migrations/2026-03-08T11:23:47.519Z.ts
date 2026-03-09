import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // Add member_category column to member table
  await db.schema
    .alterTable("member")
    .addColumn("member_category", "text")
    .execute();

  // Backfill existing members based on their current membership type.
  // Senior types are set first (higher priority). The junior UPDATE below
  // uses AND member_category IS NULL to avoid overwriting a senior category
  // for members who happen to hold both membership types.
  await sql`
    UPDATE member
    SET member_category = 'senior'
    WHERE id IN (
      SELECT m.id FROM member m
      INNER JOIN membership ms ON ms.member_id = m.id
      WHERE ms.type IN ('senior_player', 'senior_women_player', 'social', 'concessionary')
      AND ms.dependent_id IS NULL
    )
  `.execute(db);

  // junior → junior
  await sql`
    UPDATE member
    SET member_category = 'junior'
    WHERE id IN (
      SELECT m.id FROM member m
      INNER JOIN membership ms ON ms.member_id = m.id
      WHERE ms.type = 'junior'
      AND ms.dependent_id IS NULL
    )
    AND member_category IS NULL
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("member").dropColumn("member_category").execute();
}

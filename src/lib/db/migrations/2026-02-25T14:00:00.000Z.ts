import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("charge_dependent")
    .addColumn("charge_id", "uuid", (col) =>
      col.notNull().references("charge.id"),
    )
    .addColumn("dependent_id", "uuid", (col) =>
      col.notNull().references("dependent.id"),
    )
    .addPrimaryKeyConstraint("charge_dependent_pk", [
      "charge_id",
      "dependent_id",
    ])
    .execute();
}

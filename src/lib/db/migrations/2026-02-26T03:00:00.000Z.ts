import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("junior_team")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("age_group", "text", (col) => col.notNull())
    .addColumn("sex", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();

  await db.schema
    .createTable("junior_team_manager")
    .addColumn("user_id", "text", (col) => col.notNull().references("user.id"))
    .addColumn("junior_team_id", "text", (col) =>
      col.notNull().references("junior_team.id"),
    )
    .addPrimaryKeyConstraint("junior_team_manager_pk", [
      "user_id",
      "junior_team_id",
    ])
    .execute();

  // Seed the junior_team table with all age group / sex combinations
  const teams = [
    { id: "u11-boys", name: "U11 Boys", age_group: "U11", sex: "male" },
    { id: "u11-girls", name: "U11 Girls", age_group: "U11", sex: "female" },
    { id: "u13-boys", name: "U13 Boys", age_group: "U13", sex: "male" },
    { id: "u13-girls", name: "U13 Girls", age_group: "U13", sex: "female" },
    { id: "u15-boys", name: "U15 Boys", age_group: "U15", sex: "male" },
    { id: "u15-girls", name: "U15 Girls", age_group: "U15", sex: "female" },
    { id: "u19-boys", name: "U19 Boys", age_group: "U19", sex: "male" },
    { id: "u19-girls", name: "U19 Girls", age_group: "U19", sex: "female" },
  ];

  for (const team of teams) {
    await sql`INSERT INTO junior_team (id, name, age_group, sex) VALUES (${team.id}, ${team.name}, ${team.age_group}, ${team.sex})`.execute(
      db,
    );
  }
}

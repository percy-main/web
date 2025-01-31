#!/bin/zx

const filename = `${new Date().toISOString()}.ts`;

const kyseley_migration = `
import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
}
`;

$`echo ${kyseley_migration} >> "src/lib/db/migrations/${filename}"`;

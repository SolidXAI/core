import { QueryRunner } from 'typeorm';

export async function addColumnIfNotExists(
  queryRunner: QueryRunner,
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF COL_LENGTH('${table}', '${column}') IS NULL
BEGIN
    ${ddl}
END
  `);
}

export async function createUniqueIndexIfNotExists(
  queryRunner: QueryRunner,
  table: string,
  indexName: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = '${indexName}'
    AND object_id = OBJECT_ID('${table}')
)
BEGIN
  ${ddl}
END
  `);
}

export async function addConstraintIfNotExists(
  queryRunner: QueryRunner,
  constraintName: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF NOT EXISTS (
  SELECT 1 FROM sys.objects
  WHERE name = '${constraintName}'
)
BEGIN
  ${ddl}
END
  `);
}

export async function dropColumnIfExists(
  queryRunner: QueryRunner,
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF COL_LENGTH('${table}', '${column}') IS NOT NULL
BEGIN
  ${ddl}
END
  `);
}

export async function dropUniqueIndexIfExists(
  queryRunner: QueryRunner,
  table: string,
  indexName: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = '${indexName}'
    AND object_id = OBJECT_ID('${table}')
)
BEGIN
  ${ddl}
END
  `);
}

export async function dropConstraintIfExists(
  queryRunner: QueryRunner,
  constraintName: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF EXISTS (
  SELECT 1 FROM sys.objects
  WHERE name = '${constraintName}'
)
BEGIN
  ${ddl}
END
  `);
}

export async function createTableIfNotExists(
  queryRunner: QueryRunner,
  table: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF OBJECT_ID('${table}', 'U') IS NULL
BEGIN
  ${ddl}
END
  `);
}

export async function dropTableIfExists(
  queryRunner: QueryRunner,
  table: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF OBJECT_ID('${table}', 'U') IS NOT NULL
BEGIN
  ${ddl}
END
  `);
}

export async function createIndexIfNotExists(
  queryRunner: QueryRunner,
  table: string,
  indexName: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = '${indexName}'
    AND object_id = OBJECT_ID('${table}')
)
BEGIN
  ${ddl}
END
  `);
}

export async function dropIndexIfExists(
  queryRunner: QueryRunner,
  table: string,
  indexName: string,
  ddl: string,
): Promise<void> {
  await queryRunner.query(`
IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = '${indexName}'
    AND object_id = OBJECT_ID('${table}')
)
BEGIN
  ${ddl}
END
  `);
}

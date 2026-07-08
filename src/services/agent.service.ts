import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Read-only SQL + introspection endpoint service for the agent/MCP.
 *
 * In embedded (PGlite) mode the agent/MCP hold ZERO direct DB connections and
 * route all DB work through core's HTTP API. This service executes a validated
 * read-only statement on core's owned default DataSource (the single PGlite
 * connection when embedded), so the agent gets the truest "use the main
 * server's DB layer" semantics without a second PGlite connection.
 */
@Injectable()
export class AgentService {
  private static readonly READ_ONLY_LEADING = new Set(['select', 'with', 'explain', 'show']);

  private static readonly BANNED_KEYWORDS = new Set([
    'insert',
    'update',
    'delete',
    'drop',
    'alter',
    'grant',
    'revoke',
    'truncate',
    'create',
    'replace',
    'merge',
    'call',
    'exec',
    'execute',
    'vacuum',
    'copy',
    'attach',
    'detach',
    'comment',
    'set',
    'lock',
    'do',
    'begin',
    'commit',
    'rollback',
    'start',
    'shutdown',
    'reindex',
    'cluster',
  ]);

  constructor(private readonly moduleRef: ModuleRef) {}

  /** Resolves the default TypeORM DataSource (the one wired to PGlite when embedded). */
  private resolveDefaultDataSource(): DataSource {
    const token = getDataSourceToken();
    const dataSource = this.moduleRef.get<DataSource>(token, { strict: false });
    if (!dataSource) {
      throw new NotFoundException('Default datasource is not registered in the current runtime.');
    }
    return dataSource;
  }

  /**
   * Strips SQL string literals ('...'), double-quoted identifiers ("..."),
   * line comments, and block comments so that lexical checks don't trip on
   * tokens that appear inside literals/identifiers/comments.
   */
  private static stripLiteralsAndComments(sql: string): string {
    let out = '';
    let i = 0;
    const n = sql.length;
    while (i < n) {
      const ch = sql[i];
      const two = sql.slice(i, i + 2);

      if (two === '--') {
        i += 2;
        while (i < n && sql[i] !== '\n') i++;
        continue;
      }

      if (two === '/*') {
        i += 2;
        while (i < n && sql.slice(i, i + 2) !== '*/') i++;
        i += 2;
        continue;
      }

      if (ch === "'") {
        i++;
        while (i < n) {
          if (sql[i] === "'") {
            if (sql[i + 1] === "'") {
              i += 2;
              continue;
            }
            i++;
            break;
          }
          i++;
        }
        out += "''";
        continue;
      }

      if (ch === '"') {
        i++;
        while (i < n) {
          if (sql[i] === '"') {
            if (sql[i + 1] === '"') {
              i += 2;
              continue;
            }
            i++;
            break;
          }
          i++;
        }
        out += '""';
        continue;
      }

      out += ch;
      i++;
    }
    return out;
  }

  /**
   * Validates that a SQL string is a single read-only statement.
   * Throws BadRequestException on any violation; never returns when invalid.
   */
  assertReadOnlySql(sql: string): void {
    if (!sql || typeof sql !== 'string') {
      throw new BadRequestException('SQL statement is required.');
    }

    const stripped = AgentService.stripLiteralsAndComments(sql).trim();
    if (!stripped) {
      throw new BadRequestException('SQL statement is empty.');
    }

    // Allow at most one trailing semicolon.
    const core = stripped.replace(/;\s*$/, '').trim();
    if (!core) {
      throw new BadRequestException('SQL statement is empty.');
    }
    if (core.includes(';')) {
      throw new BadRequestException('Only a single read-only statement is allowed.');
    }

    const firstTokenMatch = core.match(/^\s*([A-Za-z_]+)/);
    if (!firstTokenMatch) {
      throw new BadRequestException('Unable to parse the leading keyword of the SQL statement.');
    }
    const leading = firstTokenMatch[1].toLowerCase();
    if (!AgentService.READ_ONLY_LEADING.has(leading)) {
      throw new BadRequestException(
        `Only read-only queries starting with SELECT, WITH, EXPLAIN, or SHOW are allowed. Received "${leading.toUpperCase()}".`,
      );
    }

    const tokens = core.match(/[A-Za-z_]+/g) ?? [];
    for (const token of tokens) {
      if (AgentService.BANNED_KEYWORDS.has(token.toLowerCase())) {
        throw new BadRequestException(
          `Disallowed SQL keyword "${token.toUpperCase()}" in read-only query.`,
        );
      }
    }
  }

  /**
   * Executes a validated read-only SQL statement on core's owned default
   * DataSource and returns the raw rows.
   */
  async runReadOnlySql(sql: string, params?: unknown[]): Promise<{ rows: any[] }> {
    this.assertReadOnlySql(sql);
    const dataSource = this.resolveDefaultDataSource();
    const rows = await dataSource.query(sql, (params ?? []) as any);
    return { rows: rows ?? [] };
  }

  /**
   * Returns all base tables + their columns from information_schema, excluding
   * PGlite's internal schemas. Mirrors the canonical postgres introspection
   * SELECTs but exposes a lighter payload suited to the agent's needs.
   */
  async introspect(): Promise<{ tables: any[]; columns: any[] }> {
    const dataSource = this.resolveDefaultDataSource();

    const tables: any[] = await dataSource.query(`
      SELECT
        TABLE_SCHEMA AS "tableSchema",
        TABLE_NAME  AS "tableName"
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_SCHEMA NOT IN ('pg_catalog', 'information_schema')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    const columns: any[] = await dataSource.query(`
      SELECT
        c.TABLE_SCHEMA       AS "tableSchema",
        c.TABLE_NAME         AS "tableName",
        c.COLUMN_NAME        AS "columnName",
        c.DATA_TYPE          AS "dataType",
        c.IS_NULLABLE        AS "isNullable",
        c.COLUMN_DEFAULT     AS "defaultValue",
        c.ORDINAL_POSITION   AS "ordinalPosition"
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA NOT IN ('pg_catalog', 'information_schema')
      ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
    `);

    return { tables: tables ?? [], columns: columns ?? [] };
  }
}
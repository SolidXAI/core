import { BadRequestException } from '@nestjs/common';
import { AgentService } from './agent.service';

describe('AgentService.assertReadOnlySql', () => {
  // assertReadOnlySql is a pure validator; moduleRef is not touched.
  const service = new AgentService(undefined as any);

  function expectInvalid(sql: string, fragment?: string) {
    expect(() => service.assertReadOnlySql(sql)).toThrow(BadRequestException);
    if (fragment) {
      expect(() => service.assertReadOnlySql(sql)).toThrow(new RegExp(fragment, 'i'));
    }
  }

  describe('accepts valid read-only statements', () => {
    const valid = [
      'SELECT 1',
      '   SELECT * FROM "public"."ss_setting"   ',
      "SELECT 'hello; world' FROM t",
      'WITH cte AS (SELECT 1) SELECT * FROM cte',
      'EXPLAIN SELECT * FROM ss_setting',
      'SHOW tables',
      'SELECT * FROM t WHERE col = $1',
    ];
    for (const sql of valid) {
      it(`accepts: ${sql.replace(/\s+/g, ' ')}`, () => {
        expect(() => service.assertReadOnlySql(sql)).not.toThrow();
      });
    }
  });

  describe('rejects empty / non-string', () => {
    it('rejects empty', () => expectInvalid(''));
    it('rejects whitespace-only', () => expectInvalid('   \n\t  '));
    it('rejects just a semicolon', () => expectInvalid(';'));
    it('rejects undefined', () => expectInvalid(undefined as unknown as string));
  });

  describe('rejects non-read-only leading keywords', () => {
    for (const sql of [
      'INSERT INTO t VALUES (1)',
      'UPDATE t SET a = 1',
      'DELETE FROM t',
      'DROP TABLE t',
      'ALTER TABLE t ADD COLUMN a int',
      'TRUNCATE t',
      'CREATE TABLE t (a int)',
      'GRANT SELECT ON t TO u',
      'REVOKE SELECT ON t FROM u',
      'VACUUM',
      'BEGIN',
    ]) {
      it(`rejects: ${sql}`, () => expectInvalid(sql, 'read-only|Only a single'));
    }
  });

  describe('rejects banned keywords inside an otherwise SELECT-shaped statement', () => {
    for (const sql of [
      'SELECT 1; DROP TABLE t',
      "SELECT 1; DELETE FROM t WHERE '1' = '1'",
    ]) {
      it(`rejects: ${sql}`, () => expectInvalid(sql));
    }
  });

  describe('rejects multiple statements', () => {
    it('rejects two SELECTs separated by semicolon', () =>
      expectInvalid('SELECT 1; SELECT 2', 'single read-only statement'));
  });

  describe('does not trip on literals/identifiers/comments', () => {
    it('accepts a SELECT containing a semicolon inside a string literal', () => {
      expect(() => service.assertReadOnlySql("SELECT ';' AS s")).not.toThrow();
    });
    it('accepts a SELECT containing the word DROP inside a string literal', () => {
      expect(() => service.assertReadOnlySql("SELECT 'DROP TABLE t' AS s")).not.toThrow();
    });
    it('accepts a SELECT containing banned-keyword-like text in a comment', () => {
      expect(() => service.assertReadOnlySql('SELECT 1 -- DROP TABLE t\nFROM x')).not.toThrow();
    });
    it("accepts a column named \"set\" (quoted identifier)", () => {
      expect(() => service.assertReadOnlySql('SELECT "set" FROM t')).not.toThrow();
    });
  });
});
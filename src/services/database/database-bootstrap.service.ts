import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { readdir, readFile } from 'fs/promises';
import * as path from 'path';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  async onModuleInit() {
    if (!this.dataSource.isInitialized) {
      this.logger.warn(`[${this.dataSource.name}] DataSource not initialized. Skipping SQL bootstrap.`);
      return;
    }

    this.logger.debug(`[${this.dataSource.name}] Bootstrapping stored procedures...`);

    await this.applyAllSqlFiles();

    this.logger.debug(`[${this.dataSource.name}] SQL bootstrap completed`);
  }

  private resolveSqlDirectory(): string {
    const datasourceName = this.dataSource.name || 'default';
    const dbType = this.dataSource.options.type;

    const sqlFilePath = path.resolve(__dirname, `../../../sql/${datasourceName}/${dbType}`);

    return sqlFilePath
  }

  private async applyAllSqlFiles() {
    const sqlDir = this.resolveSqlDirectory();

    this.logger.debug(`[${this.dataSource.name}] SQL directory: ${sqlDir}`);

    let files: string[];
    try {
      files = await readdir(sqlDir);
    } catch {
      this.logger.warn(
        `[${this.dataSource.name}] No SQL directory found. Skipping.`,
      );
      return;
    }

    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (!sqlFiles.length) {
      this.logger.warn(
        `[${this.dataSource.name}] No SQL files found`,
      );
      return;
    }

    for (const file of sqlFiles) {
      await this.applySqlFileSafely(
        path.join(sqlDir, file),
        file,
      );
    }
  }

  private async applySqlFileSafely(
    filePath: string,
    fileName: string,
  ) {
    this.logger.debug(`[${this.dataSource.name}] Applying ${fileName}`);

    try {
      const sql = await readFile(filePath, 'utf8');
      await this.dataSource.query(sql);

      this.logger.debug(`[${this.dataSource.name}] Applied ${fileName}`);
    } catch (error) {
      // DO NOT THROW — continue with next file
      this.logger.error(
        `[${this.dataSource.name}] Failed ${fileName}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

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
      this.logger.warn(
        `[${this.dataSource.name}] DataSource not initialized. Skipping SQL bootstrap.`,
      );
      return;
    }

    this.logger.log(
      `[${this.dataSource.name}] Bootstrapping stored procedures...`,
    );

    await this.applyAllSqlFiles();

    this.logger.log(
      `[${this.dataSource.name}] SQL bootstrap completed`,
    );
  }

  private resolveSqlDirectory(): string {
    const datasourceName = this.dataSource.name || 'default';
    const dbType = this.dataSource.options.type;

    const sqlFilePath = path.resolve(__dirname, `../../../sql/${datasourceName}/${dbType}`);

    return sqlFilePath
  }

  private async applyAllSqlFiles() {
    const sqlDir = this.resolveSqlDirectory();

    this.logger.log(
      `[${this.dataSource.name}] SQL directory: ${sqlDir}`,
    );

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
    this.logger.log(
      `[${this.dataSource.name}] Applying ${fileName}`,
    );

    try {
      const sql = await readFile(filePath, 'utf8');
      await this.dataSource.query(sql);

      this.logger.log(
        `[${this.dataSource.name}] Applied ${fileName}`,
      );
    } catch (error) {
      // DO NOT THROW — continue with next file
      this.logger.error(
        `[${this.dataSource.name}] Failed ${fileName}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}


// project-root/
// │
// ├── sql/
// │   ├── default/
// │   │   └── postgres/
// │   │       ├── 001-functions.sql
// │   │       └── 002-procedures.sql
// │   │
// │   ├── reporting/
// │   │   └── postgres/
// │   │       └── 001-reporting.sql
// │   │
// │   └── auth/
// │       └── mysql/
// │           └── 001-auth-procedures.sql
// │
// ├── src/
// │   └── database-bootstrap/
// │       ├── database-bootstrap.module.ts
// │       └── database-bootstrap.service.ts


// -------old version

// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { DataSource } from 'typeorm';
// import { readFile } from 'fs/promises';
// import * as path from 'path';

// @Injectable()
// export class DatabaseBootstrapService implements OnModuleInit {
//   private readonly logger = new Logger(DatabaseBootstrapService.name);

//   constructor(private readonly dataSource: DataSource) { }

//   async onModuleInit() {
//     // if (process.env.DB_BOOTSTRAP_SP !== 'true') {
//     //   this.logger.log('DB SP bootstrap skipped');
//     //   return;
//     // }
//     const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
//     if (solidCliRunning === "true") {
//       return;
//     }

//     if (!this.dataSource.isInitialized) return;

//     this.logger.log('Bootstrapping stored procedures...');
//     this.logger.log(this.dataSource);

//     await this.applySqlFile('proc_CleanupModuleMetadata.sql');
//     await this.applySqlFile('proc_CleanupModelMetadata.sql');

//     this.logger.log('Stored procedures bootstrapped');
//   }

//   private async applySqlFile(fileName: string) {
//     // TODO: how are we checking if the SP already exists? Should we drop and recreate?
//     // TODO: how do we take care of multiple datasources, since SPs will be different for different datasources?
//     const type = this.dataSource.options.type;
//     const sqlFilePath = path.resolve(__dirname, `../../../sql/${type}`, fileName);


//     this.logger.log(`__dirname: ${__dirname}`);
//     this.logger.log(`Applying SQL file: ${sqlFilePath}`);

//     const sql = await readFile(sqlFilePath, 'utf8');

//     await this.dataSource.query(sql);
//   }
// }

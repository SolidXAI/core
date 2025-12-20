import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { readFile } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(private readonly dataSource: DataSource) { }

  async onModuleInit() {
    // if (process.env.DB_BOOTSTRAP_SP !== 'true') {
    //   this.logger.log('DB SP bootstrap skipped');
    //   return;
    // }
    const solidCliRunning = process.env.SOLID_CLI_RUNNING || "false";
    if (solidCliRunning === "true") {
      return;
    }

    if (!this.dataSource.isInitialized) return;

    this.logger.log('Bootstrapping stored procedures...');

    await this.applySqlFile('proc_CleanupModuleMetadata.sql');
    await this.applySqlFile('proc_CleanupModelMetadata.sql');

    this.logger.log('Stored procedures bootstrapped');
  }

  private async applySqlFile(fileName: string) {
    // TODO: how are we checking if the SP already exists? Should we drop and recreate?
    // TODO: how do we take care of multiple datasources, since SPs will be different for different datasources?
    const sqlFilePath = path.resolve(
      __dirname,
      '../../../sql/postgres',
      fileName,
    );

    this.logger.log(`__dirname: ${__dirname}`);
    this.logger.log(`Applying SQL file: ${sqlFilePath}`);

    const sql = await readFile(sqlFilePath, 'utf8');

    await this.dataSource.query(sql);
  }
}


// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { DataSource } from 'typeorm';
// import { readFile, readdir } from 'fs/promises';
// import * as path from 'path';

// @Injectable()
// export class DatabaseBootstrapService implements OnModuleInit {
//   private readonly logger = new Logger(DatabaseBootstrapService.name);

//   constructor(private readonly dataSource: DataSource) {}

//   async onModuleInit() {
//     if (!this.dataSource.isInitialized) return;

//     this.logger.log('Bootstrapping stored procedures...');

//     await this.applyAllSqlFiles();

//     this.logger.log('Stored procedures bootstrapped');
//   }

//   private async applyAllSqlFiles() {
//     const postgresDir = path.resolve(
//       __dirname,
//       '../../../sql/postgres',
//     );

//     this.logger.log(`Postgres SQL directory: ${postgresDir}`);

//     let files: string[];

//     try {
//       files = await readdir(postgresDir);
//     } catch (err) {
//       this.logger.error(`Failed to read postgres directory`, err);
//       return;
//     }

//     const sqlFiles = files
//       .filter((file) => file.endsWith('.sql'))
//       .sort(); // ensures deterministic execution order

//     if (!sqlFiles.length) {
//       this.logger.warn('No SQL files found to apply');
//       return;
//     }

//     for (const file of sqlFiles) {
//       const fullPath = path.join(postgresDir, file);
//       await this.applySqlFile(fullPath);
//     }
//   }

//   private async applySqlFile(filePath: string) {
//     this.logger.log(`Applying SQL file: ${filePath}`);

//     const sql = await readFile(filePath, 'utf8');
//     await this.dataSource.query(sql);
//   }
// }

import * as fs from "fs/promises";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { getDataSourceToken } from "@nestjs/typeorm";
import { kebabCase, snakeCase } from "lodash";
import * as path from "path";
import { ERROR_MESSAGES } from "src/constants/error-messages";
import { RelationType, SolidFieldType } from "src/dtos/create-field-metadata.dto";
import { FieldMetadata } from "src/entities/field-metadata.entity";
import { ModelMetadata } from "src/entities/model-metadata.entity";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { classify } from "src/helpers/string.helper";
import { FieldMetadataRepository } from "src/repository/field-metadata.repository";
import { ModelMetadataRepository } from "src/repository/model-metadata.repository";
import { DataSource, EntityMetadata, QueryRunner, Table } from "typeorm";

export interface RemovedFieldMigrationResult {
    dryRun: boolean;
    modelName: string;
    operations: string[];
    removedFieldNames: string[];
}

@Injectable()
export class RemovedFieldMigrationService {
    constructor(
        private readonly modelMetadataRepo: ModelMetadataRepository,
        private readonly fieldMetadataRepo: FieldMetadataRepository,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        private readonly moduleRef: ModuleRef,
    ) { }

    private readonly logger = new Logger(RemovedFieldMigrationService.name);

    // Cleans fields marked for removal by updating schema state and metadata for a single model.
    async migrateMarkedFields(modelUserKey: string, dryRun: boolean = false): Promise<RemovedFieldMigrationResult> {
        if (!modelUserKey) {
            throw new BadRequestException("Model name is required");
        }

        const model = await this.modelMetadataRepo.findOne({
            where: { singularName: modelUserKey },
            relations: { fields: true, module: true },
        });

        if (!model) {
            throw new NotFoundException(ERROR_MESSAGES.MODEL_NOT_FOUND(modelUserKey));
        }

        const fieldsForRemoval = model.fields.filter((field) => field.isMarkedForRemoval);
        const operations: string[] = [];

        if (fieldsForRemoval.length === 0) {
            const message = `No fields marked for removal were found for model "${model.singularName}".`;
            this.logger.log(message);
            operations.push(message);
            return {
                dryRun,
                modelName: model.singularName,
                operations,
                removedFieldNames: [],
            };
        }

        const dataSource = await this.resolveDataSource(model.dataSource);
        const entityMetadata = this.resolveEntityMetadata(dataSource, model);
        const queryRunner = dataSource.createQueryRunner();

        try {
            await queryRunner.connect();

            if (!dryRun) {
                await queryRunner.startTransaction();
            }

            for (const field of fieldsForRemoval) {
                await this.cleanupMarkedField({
                    field,
                    model,
                    entityMetadata,
                    queryRunner,
                    dryRun,
                    operations,
                });
            }

            if (!dryRun) {
                await queryRunner.commitTransaction();
            }
        } catch (error) {
            if (!dryRun && queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }

        return {
            dryRun,
            modelName: model.singularName,
            operations,
            removedFieldNames: fieldsForRemoval.map((field) => field.name),
        };
    }

    private async cleanupMarkedField(params: { field: FieldMetadata; model: ModelMetadata; entityMetadata?: EntityMetadata; queryRunner: QueryRunner; dryRun: boolean; operations: string[]; }): Promise<void> {
        const { field, model, entityMetadata, queryRunner, dryRun, operations } = params;
        const relationMetadata = entityMetadata?.relations.find((relation) => relation.propertyName === field.name);
        const resolvedTableName = entityMetadata?.tableName || model.tableName;

        if (field.type !== SolidFieldType.relation) {
            const columnCandidates = this.buildColumnCandidates(field, entityMetadata, relationMetadata);
            await this.dropColumnsForField(resolvedTableName, field, columnCandidates, queryRunner, dryRun, operations);
            return;
        }

        if (field.relationType === RelationType.manyToOne) {
            const columnCandidates = this.buildColumnCandidates(field, entityMetadata, relationMetadata);
            await this.dropColumnsForField(resolvedTableName, field, columnCandidates, queryRunner, dryRun, operations);
            return;
        }

        if (field.relationType === RelationType.manyTomany) {
            const joinTableName = relationMetadata?.junctionEntityMetadata?.tableName || field.relationJoinTableName;
            const ownsJoinTable = relationMetadata?.isOwning || field.isRelationManyToManyOwner;

            if (!ownsJoinTable) {
                operations.push(`No direct database cleanup required for inverse many-to-many field "${field.name}".`);
                return;
            }

            if (!joinTableName) {
                operations.push(`Skipping join-table cleanup for "${field.name}" because no join table name could be resolved.`);
                return;
            }

            await this.dropJoinTable(joinTableName, field, queryRunner, dryRun, operations);
            return;
        }

        operations.push(`No direct database cleanup required for relation field "${field.name}" with type "${field.relationType}".`);
    }

    private async dropColumnsForField(tableName: string, field: FieldMetadata, columnCandidates: string[], queryRunner: QueryRunner, dryRun: boolean, operations: string[],): Promise<void> {
        if (!tableName) {
            operations.push(`Skipping field "${field.name}" because the model table name could not be resolved.`);
            return;
        }

        if (columnCandidates.length === 0) {
            operations.push(`Skipping field "${field.name}" because no column candidates could be resolved.`);
            return;
        }

        const handledColumns = new Set<string>();
        let droppedAnyColumn = false;

        for (const columnName of columnCandidates) {
            if (!columnName || handledColumns.has(columnName)) {
                continue;
            }

            handledColumns.add(columnName);
            const table = await this.loadTable(queryRunner, tableName);
            const column = table?.columns.find((tableColumn) => tableColumn.name === columnName);

            if (!column) {
                continue;
            }

            droppedAnyColumn = true;
            await this.dropColumnArtifacts(table, columnName, queryRunner, dryRun, operations);
        }

        if (!droppedAnyColumn) {
            operations.push(`No database column found for field "${field.name}" on table "${tableName}". Metadata cleanup will still proceed.`);
        }
    }

    private async dropColumnArtifacts(table: Table, columnName: string, queryRunner: QueryRunner, dryRun: boolean, operations: string[],): Promise<void> {
        for (const foreignKey of table.foreignKeys.filter((item) => item.columnNames.includes(columnName))) {
            operations.push(`Drop foreign key "${foreignKey.name}" on "${table.name}.${columnName}"`);
            if (!dryRun) {
                await queryRunner.dropForeignKey(table, foreignKey);
            }
        }

        for (const uniqueConstraint of table.uniques.filter((item) => item.columnNames.includes(columnName))) {
            operations.push(`Drop unique constraint "${uniqueConstraint.name}" on "${table.name}.${columnName}"`);
            if (!dryRun) {
                await queryRunner.dropUniqueConstraint(table, uniqueConstraint);
            }
        }

        for (const index of table.indices.filter((item) => item.columnNames.includes(columnName))) {
            operations.push(`Drop index "${index.name}" on "${table.name}.${columnName}"`);
            if (!dryRun) {
                await queryRunner.dropIndex(table, index);
            }
        }

        operations.push(`Drop column "${table.name}.${columnName}"`);
        if (!dryRun) {
            await queryRunner.dropColumn(table, columnName);
        }
    }

    private async dropJoinTable(joinTableName: string, field: FieldMetadata, queryRunner: QueryRunner, dryRun: boolean, operations: string[]): Promise<void> {
        const table = await this.loadTable(queryRunner, joinTableName);
        if (!table) {
            operations.push(`Join table "${joinTableName}" for field "${field.name}" does not exist. Metadata cleanup will still proceed.`);
            return;
        }

        operations.push(`Drop join table "${joinTableName}" for field "${field.name}"`);
        if (!dryRun) {
            await queryRunner.dropTable(joinTableName);
        }
    }

    private buildColumnCandidates(field: FieldMetadata, entityMetadata?: EntityMetadata, relationMetadata?: EntityMetadata["relations"][number]): string[] {
        const columnCandidates = new Set<string>();

        relationMetadata?.joinColumns?.forEach((column) => {
            if (column.databaseName) {
                columnCandidates.add(column.databaseName);
            }
        });

        entityMetadata?.columns
            .filter((column) => column.propertyName === field.name)
            .forEach((column) => {
                if (column.databaseName) {
                    columnCandidates.add(column.databaseName);
                }
            });

        if (field.columnName) {
            columnCandidates.add(field.columnName);
        }

        if (field.relationCoModelColumnName) {
            columnCandidates.add(field.relationCoModelColumnName);
        }

        if (field.type === SolidFieldType.relation && field.relationType === RelationType.manyToOne) {
            columnCandidates.add(`${snakeCase(field.name)}_id`);
        } else {
            columnCandidates.add(snakeCase(field.name));
        }

        return [...columnCandidates].filter(Boolean);
    }

    private async resolveDataSource(dataSourceName?: string): Promise<DataSource> {
        const normalizedDataSourceName = dataSourceName && dataSourceName !== "default" ? dataSourceName : undefined;
        const token = normalizedDataSourceName ? getDataSourceToken(normalizedDataSourceName) : getDataSourceToken();
        let dataSource: DataSource | undefined;

        try {
            dataSource = this.moduleRef.get<DataSource>(token, { strict: false });
        } catch (error: any) {
            throw new NotFoundException(`Datasource "${normalizedDataSourceName ?? "default"}" could not be resolved: ${error?.message ?? error}`);
        }

        if (!dataSource) {
            throw new NotFoundException(`Datasource "${normalizedDataSourceName ?? "default"}" could not be resolved.`);
        }

        if (!dataSource.isInitialized) {
            await dataSource.initialize();
        }

        return dataSource;
    }

    private resolveEntityMetadata(dataSource: DataSource, model: ModelMetadata): EntityMetadata | undefined {
        const candidates = [classify(model.singularName), model.singularName, model.tableName].filter(Boolean);

        for (const candidate of candidates) {
            try {
                return dataSource.getMetadata(candidate);
            } catch {
                // Try the next candidate.
            }
        }

        return dataSource.entityMetadatas.find((metadata) => metadata.tableName === model.tableName);
    }

    private async resolveMetadataFilePath(moduleName: string): Promise<string> {
        const defaultPath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        if (await this.fileExists(defaultPath)) {
            return defaultPath;
        }

        const dashModuleName = kebabCase(moduleName);
        const moduleMetadataFilePath = path.resolve(
            process.cwd(),
            "module-metadata",
            dashModuleName,
            `${dashModuleName}-metadata.json`,
        );

        if (await this.fileExists(moduleMetadataFilePath)) {
            return moduleMetadataFilePath;
        }

        return defaultPath;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async loadTable(queryRunner: QueryRunner, tableName: string): Promise<Table | undefined> {
        if (!tableName) {
            return undefined;
        }

        const hasTable = await queryRunner.hasTable(tableName);
        if (!hasTable) {
            return undefined;
        }

        return queryRunner.getTable(tableName) ?? undefined;
    }
}
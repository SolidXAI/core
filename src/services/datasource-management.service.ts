import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { CreateDatasourceManagementDto } from "src/dtos/create-datasource-management.dto";
import { DatasourceType } from "src/dtos/create-model-metadata.dto";
import { SolidTsMorphService } from "./solid-ts-morph.service";

export type DatasourceRecord = {
    name: string;
    displayName: string;
    type: DatasourceType;
    envPrefix: string;
    isDefault: boolean;
    host: string;
    port: number | null;
    database: string;
    username: string;
    passwordConfigured: boolean;
    synchronize: boolean | null;
    logging: boolean | null;
    moduleFile: string;
    envFile: string;
    advanced: Record<string, any>;
};

type DatasourceAnnotations = {
    displayName?: string;
    envPrefix?: string;
    advanced?: Record<string, any>;
};

@Injectable()
export class DatasourceManagementService {
    private readonly logger = new Logger(DatasourceManagementService.name);

    constructor(
        private readonly solidTsMorphService: SolidTsMorphService,
    ) { }

    findMany() {
        const records = this.listRecords();

        return {
            data: {
                records,
                meta: {
                    totalRecords: records.length,
                },
            },
        };
    }

    listRecords() {
        const solidApiRoot = this.resolveSolidApiRoot();
        const envFilePath = join(solidApiRoot, ".env");
        const envMap = this.parseEnvFile(envFilePath);
        const datasourceFiles = this.getDatasourceModuleFiles(solidApiRoot);

        return datasourceFiles
            .map((moduleFilePath) => this.readDatasourceRecord(moduleFilePath, envMap, envFilePath))
            .sort((left, right) => {
                if (left.isDefault && !right.isDefault) return -1;
                if (!left.isDefault && right.isDefault) return 1;
                return left.displayName.localeCompare(right.displayName);
            });
    }

    findOneByName(name: string) {
        const normalizedName = name?.trim().toLowerCase();
        if (!normalizedName) {
            return null;
        }

        return this.listRecords().find((record) => record.name.toLowerCase() === normalizedName) ?? null;
    }

    async create(createDto: CreateDatasourceManagementDto) {
        const solidApiRoot = this.resolveSolidApiRoot();
        const datasourceName = createDto.name.trim().toLowerCase();
        const envPrefix = this.toEnvPrefix(datasourceName);
        const srcRoot = join(solidApiRoot, "src");
        const moduleFilePath = join(srcRoot, `app-${datasourceName}-database.module.ts`);
        const appModulePath = join(srcRoot, "app.module.ts");
        const envFilePath = join(solidApiRoot, ".env");
        const displayName = createDto.displayName?.trim() || this.toDisplayName(datasourceName);

        if (datasourceName === "default") {
            throw new BadRequestException('Datasource name "default" is reserved for the bootstrap datasource.');
        }

        if (existsSync(moduleFilePath)) {
            throw new BadRequestException(`Datasource "${datasourceName}" already exists.`);
        }

        if (!existsSync(appModulePath)) {
            throw new BadRequestException(`Unable to locate app.module.ts in ${solidApiRoot}.`);
        }

        const envMap = this.parseEnvFile(envFilePath);
        const existingEnvKeys = Object.keys(envMap).filter((key) => key.startsWith(`${envPrefix}_DATABASE_`));
        if (existingEnvKeys.length) {
            throw new BadRequestException(
                `Env prefix "${envPrefix}" is already in use. Remove the existing datasource variables before reusing this name.`,
            );
        }

        const moduleClassName = `${this.toPascalCase(datasourceName)}DBModule`;
        const advancedMetadata = this.buildAdvancedMetadata(createDto);
        const moduleContent = this.renderDatasourceModule({
            datasourceName,
            displayName,
            envPrefix,
            moduleClassName,
            type: createDto.type,
            advancedMetadata,
        });

        this.solidTsMorphService.begin();
        try {
            this.solidTsMorphService.createNewFile(moduleFilePath, moduleContent, false);
            this.solidTsMorphService.registerNestProvider(
                appModulePath,
                moduleClassName,
                `./app-${datasourceName}-database.module`,
                ["imports"],
            );
            await this.solidTsMorphService.commit();
        } catch (error) {
            this.solidTsMorphService.rollback();
            this.logger.error(`Failed to create datasource "${datasourceName}"`, error as any);
            throw error;
        }

        this.upsertManagedEnvBlock(
            envFilePath,
            datasourceName,
            this.renderEnvBlock(createDto, envPrefix),
        );

        const refreshedEnvMap = this.parseEnvFile(envFilePath);
        return {
            data: this.readDatasourceRecord(moduleFilePath, refreshedEnvMap, envFilePath),
        };
    }

    private resolveSolidApiRoot() {
        const cwd = process.cwd();
        const candidates = [
            cwd,
            join(cwd, "solid-api"),
        ];

        for (const candidate of candidates) {
            if (existsSync(join(candidate, "src", "app.module.ts"))) {
                return candidate;
            }
        }

        throw new BadRequestException(
            "Datasource management expects to run inside a SolidX consuming project with a solid-api workspace.",
        );
    }

    private getDatasourceModuleFiles(solidApiRoot: string) {
        const srcRoot = join(solidApiRoot, "src");
        return readdirSync(srcRoot)
            .filter((fileName) => /^app-[a-z0-9-]+-database\.module\.ts$/.test(fileName))
            .map((fileName) => join(srcRoot, fileName));
    }

    private readDatasourceRecord(
        moduleFilePath: string,
        envMap: Record<string, string>,
        envFilePath: string,
    ): DatasourceRecord {
        const content = readFileSync(moduleFilePath, "utf8");
        const fileName = basename(moduleFilePath);
        const fileNameMatch = fileName.match(/^app-(.+)-database\.module\.ts$/);
        const inferredName = fileNameMatch?.[1] ?? "unknown";
        const datasourceName = this.matchFirst(
            content,
            /name\(\)\s*:\s*string\s*{\s*return\s+['"]([^'"]+)['"]/s,
        ) ?? inferredName;
        const annotations = this.parseAnnotations(content);
        const envPrefix = annotations.envPrefix || this.toEnvPrefix(datasourceName);
        const envType = envMap[`${envPrefix}_DATABASE_TYPE`];
        const inferredType =
            this.matchFirst(content, /type\(\)\s*:\s*DatasourceType\s*{\s*return\s+DatasourceType\.([a-zA-Z0-9_]+)/s)
            ?? this.matchFirst(content, /type:\s*['"]([a-zA-Z0-9_]+)['"]/s)
            ?? DatasourceType.postgres;
        const type = (envType as DatasourceType) || (inferredType as DatasourceType);
        const advancedFromEnv = this.readAdvancedEnvValues(envPrefix, envMap, type);

        return {
            name: datasourceName,
            displayName: annotations.displayName || this.toDisplayName(datasourceName),
            type,
            envPrefix,
            isDefault: datasourceName === "default",
            host: envMap[`${envPrefix}_DATABASE_HOST`] ?? "",
            port: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_PORT`]),
            database: envMap[`${envPrefix}_DATABASE_NAME`] ?? "",
            username: envMap[`${envPrefix}_DATABASE_USER`] ?? "",
            passwordConfigured: Boolean(envMap[`${envPrefix}_DATABASE_PASSWORD`]),
            synchronize: this.toBooleanOrNull(envMap[`${envPrefix}_DATABASE_SYNCHRONIZE`]),
            logging: this.toBooleanOrNull(envMap[`${envPrefix}_DATABASE_LOGGING`]),
            moduleFile: moduleFilePath,
            envFile: envFilePath,
            advanced: {
                ...(annotations.advanced ?? {}),
                ...advancedFromEnv,
            },
        };
    }

    private parseAnnotations(content: string): DatasourceAnnotations {
        const displayName = this.matchFirst(
            content,
            /^\s*\*\s*@solidxDatasource\.displayName\s+(.+)$/m,
        );
        const envPrefix = this.matchFirst(
            content,
            /^\s*\*\s*@solidxDatasource\.envPrefix\s+([A-Z0-9_]+)$/m,
        );
        const advancedText = this.matchFirst(
            content,
            /^\s*\*\s*@solidxDatasource\.advanced\s+(.+)$/m,
        );

        let advanced: Record<string, any> | undefined;
        if (advancedText) {
            try {
                advanced = JSON.parse(advancedText);
            } catch (error) {
                this.logger.warn(`Unable to parse datasource annotation JSON in module file: ${error}`);
            }
        }

        return {
            displayName: displayName?.trim(),
            envPrefix: envPrefix?.trim(),
            advanced,
        };
    }

    private parseEnvFile(envFilePath: string) {
        if (!existsSync(envFilePath)) {
            return {};
        }

        const content = readFileSync(envFilePath, "utf8");
        const envMap: Record<string, string> = {};

        content.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) {
                return;
            }

            const normalized = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
            const separatorIndex = normalized.indexOf("=");
            if (separatorIndex === -1) {
                return;
            }

            const key = normalized.slice(0, separatorIndex).trim();
            const rawValue = normalized.slice(separatorIndex + 1).trim();
            envMap[key] = this.stripWrappingQuotes(rawValue);
        });

        return envMap;
    }

    private stripWrappingQuotes(value: string) {
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }
        return value;
    }

    private upsertManagedEnvBlock(envFilePath: string, datasourceName: string, blockBody: string) {
        const startMarker = `# >>> solidx-datasource:${datasourceName}`;
        const endMarker = `# <<< solidx-datasource:${datasourceName}`;
        const managedBlock = `${startMarker}\n${blockBody}\n${endMarker}`;
        const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const blockPattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "m");
        const existingContent = existsSync(envFilePath) ? readFileSync(envFilePath, "utf8") : "";
        let nextContent = "";

        if (blockPattern.test(existingContent)) {
            nextContent = existingContent.replace(blockPattern, managedBlock);
        } else if (!existingContent.trim()) {
            nextContent = `${managedBlock}\n`;
        } else {
            const suffix = existingContent.endsWith("\n") ? "" : "\n";
            nextContent = `${existingContent}${suffix}\n${managedBlock}\n`;
        }

        writeFileSync(envFilePath, nextContent, "utf8");
    }

    private renderEnvBlock(dto: CreateDatasourceManagementDto, envPrefix: string) {
        const lines = [
            `${envPrefix}_DATABASE_TYPE=${dto.type}`,
            `${envPrefix}_DATABASE_HOST=${dto.host}`,
            `${envPrefix}_DATABASE_PORT=${dto.port}`,
            `${envPrefix}_DATABASE_USER=${dto.username}`,
            `${envPrefix}_DATABASE_PASSWORD=${dto.password}`,
            `${envPrefix}_DATABASE_NAME=${dto.database}`,
            `${envPrefix}_DATABASE_SYNCHRONIZE=${dto.synchronize ?? false}`,
            `${envPrefix}_DATABASE_LOGGING=${dto.logging ?? false}`,
        ];

        const optionalValues: Array<[string, string | number | boolean | undefined]> = [
            [`${envPrefix}_DATABASE_SSL`, dto.ssl],
            [`${envPrefix}_DATABASE_SSL_REJECT_UNAUTHORIZED`, dto.sslRejectUnauthorized],
            [`${envPrefix}_DATABASE_POOL_MAX`, dto.poolMax],
            [`${envPrefix}_DATABASE_CONNECTION_TIMEOUT_MS`, dto.connectionTimeoutMs],
            [`${envPrefix}_DATABASE_IDLE_TIMEOUT_MS`, dto.idleTimeoutMs],
            [`${envPrefix}_DATABASE_STATEMENT_TIMEOUT_MS`, dto.statementTimeoutMs],
            [`${envPrefix}_DATABASE_IDLE_IN_TX_TIMEOUT_MS`, dto.idleInTxTimeoutMs],
            [`${envPrefix}_DATABASE_RETRY_ATTEMPTS`, dto.retryAttempts],
            [`${envPrefix}_DATABASE_RETRY_DELAY_MS`, dto.retryDelayMs],
            [`${envPrefix}_DATABASE_ENCRYPT`, dto.encrypt],
            [`${envPrefix}_DATABASE_TRUST_SERVER_CERTIFICATE`, dto.trustServerCertificate],
        ];

        optionalValues.forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") {
                return;
            }
            lines.push(`${key}=${value}`);
        });

        return lines.join("\n");
    }

    private renderDatasourceModule(args: {
        datasourceName: string;
        displayName: string;
        envPrefix: string;
        moduleClassName: string;
        type: DatasourceType;
        advancedMetadata: Record<string, any>;
    }) {
        const defaultPort = this.getDefaultPort(args.type);
        const providerSpecificFactoryLines = this.renderProviderSpecificFactoryLines(args.envPrefix, args.type);
        const providerSpecificAdvancedLines = this.renderProviderSpecificAdvancedLines(args.envPrefix, args.type);
        const advancedJson = JSON.stringify(args.advancedMetadata);

        return `import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
    DatasourceType,
    ISolidDatabaseModule,
    parseBooleanEnv,
    SolidDatabaseModule,
    WinstonTypeORMLogger,
} from "@solidxai/core";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import { Logger } from "winston";

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            name: "${args.datasourceName}",
            useFactory: (logger: Logger) => {
                const datasourceType = (process.env.${args.envPrefix}_DATABASE_TYPE || "${args.type}") as DatasourceType;
                const synchronize = parseBooleanEnv("${args.envPrefix}_DATABASE_SYNCHRONIZE");
                const logging = parseBooleanEnv("${args.envPrefix}_DATABASE_LOGGING");

                return {
                    name: "${args.datasourceName}",
                    type: datasourceType,
                    host: process.env.${args.envPrefix}_DATABASE_HOST,
                    port: +(process.env.${args.envPrefix}_DATABASE_PORT || ${defaultPort}),
                    username: process.env.${args.envPrefix}_DATABASE_USER,
                    password: process.env.${args.envPrefix}_DATABASE_PASSWORD,
                    database: process.env.${args.envPrefix}_DATABASE_NAME,
                    // Entities are attached incrementally through TypeOrmModule.forFeature(..., "${args.datasourceName}").
                    autoLoadEntities: true,
                    synchronize,
                    logging,
                    logger: logging ? new WinstonTypeORMLogger(logger) : undefined,
                    namingStrategy: new SnakeNamingStrategy(),
                    maxQueryExecutionTime: 500,
${providerSpecificFactoryLines}
${providerSpecificAdvancedLines}
                    retryAttempts: Number(process.env.${args.envPrefix}_DATABASE_RETRY_ATTEMPTS ?? 0),
                    retryDelay: Number(process.env.${args.envPrefix}_DATABASE_RETRY_DELAY_MS ?? 0),
                };
            },
            inject: [WINSTON_MODULE_PROVIDER],
        }),
    ],
})
@SolidDatabaseModule()
/**
 * @solidxDatasource.displayName ${args.displayName}
 * @solidxDatasource.envPrefix ${args.envPrefix}
 * @solidxDatasource.advanced ${advancedJson}
 */
export class ${args.moduleClassName} implements ISolidDatabaseModule {
    type(): DatasourceType {
        return DatasourceType.${args.type};
    }

    name(): string {
        return "${args.datasourceName}";
    }
}
`;
    }

    private renderProviderSpecificFactoryLines(envPrefix: string, type: DatasourceType) {
        if (type === DatasourceType.mssql) {
            return `                    options: {
                        encrypt: parseBooleanEnv("${envPrefix}_DATABASE_ENCRYPT"),
                        trustServerCertificate: parseBooleanEnv("${envPrefix}_DATABASE_TRUST_SERVER_CERTIFICATE"),
                        useUTC: true,
                    },`;
        }

        return `                    ssl: parseBooleanEnv("${envPrefix}_DATABASE_SSL")
                        ? {
                            rejectUnauthorized: process.env.${envPrefix}_DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
                        }
                        : false,`;
    }

    private renderProviderSpecificAdvancedLines(envPrefix: string, type: DatasourceType) {
        if (type === DatasourceType.postgres) {
            return `                    extra: {
                        max: Number(process.env.${envPrefix}_DATABASE_POOL_MAX ?? 20),
                        connectionTimeoutMillis: Number(process.env.${envPrefix}_DATABASE_CONNECTION_TIMEOUT_MS ?? 60000),
                        idleTimeoutMillis: Number(process.env.${envPrefix}_DATABASE_IDLE_TIMEOUT_MS ?? 30000),
                        statement_timeout: Number(process.env.${envPrefix}_DATABASE_STATEMENT_TIMEOUT_MS ?? 60000),
                        idle_in_transaction_session_timeout: Number(process.env.${envPrefix}_DATABASE_IDLE_IN_TX_TIMEOUT_MS ?? 60000),
                    },`;
        }

        return `                    extra: {
                        max: Number(process.env.${envPrefix}_DATABASE_POOL_MAX ?? 20),
                        connectionTimeoutMillis: Number(process.env.${envPrefix}_DATABASE_CONNECTION_TIMEOUT_MS ?? 30000),
                        idleTimeoutMillis: Number(process.env.${envPrefix}_DATABASE_IDLE_TIMEOUT_MS ?? 30000),
                    },`;
    }

    private buildAdvancedMetadata(dto: CreateDatasourceManagementDto) {
        return this.compactObject({
            synchronize: dto.synchronize ?? false,
            logging: dto.logging ?? false,
            ssl: dto.ssl,
            sslRejectUnauthorized: dto.sslRejectUnauthorized,
            poolMax: dto.poolMax,
            connectionTimeoutMs: dto.connectionTimeoutMs,
            idleTimeoutMs: dto.idleTimeoutMs,
            statementTimeoutMs: dto.statementTimeoutMs,
            idleInTxTimeoutMs: dto.idleInTxTimeoutMs,
            retryAttempts: dto.retryAttempts,
            retryDelayMs: dto.retryDelayMs,
            encrypt: dto.encrypt,
            trustServerCertificate: dto.trustServerCertificate,
        });
    }

    private readAdvancedEnvValues(
        envPrefix: string,
        envMap: Record<string, string>,
        type: DatasourceType,
    ) {
        const advanced: Record<string, any> = this.compactObject({
            ssl: this.toBooleanOrNull(envMap[`${envPrefix}_DATABASE_SSL`]),
            sslRejectUnauthorized: this.toBooleanOrNull(envMap[`${envPrefix}_DATABASE_SSL_REJECT_UNAUTHORIZED`]),
            poolMax: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_POOL_MAX`]),
            connectionTimeoutMs: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_CONNECTION_TIMEOUT_MS`]),
            idleTimeoutMs: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_IDLE_TIMEOUT_MS`]),
            statementTimeoutMs: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_STATEMENT_TIMEOUT_MS`]),
            idleInTxTimeoutMs: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_IDLE_IN_TX_TIMEOUT_MS`]),
            retryAttempts: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_RETRY_ATTEMPTS`]),
            retryDelayMs: this.toNumberOrNull(envMap[`${envPrefix}_DATABASE_RETRY_DELAY_MS`]),
            encrypt: this.toBooleanOrNull(envMap[`${envPrefix}_DATABASE_ENCRYPT`]),
            trustServerCertificate: this.toBooleanOrNull(envMap[`${envPrefix}_DATABASE_TRUST_SERVER_CERTIFICATE`]),
        });

        if (type !== DatasourceType.mssql) {
            delete advanced.encrypt;
            delete advanced.trustServerCertificate;
        }

        if (type !== DatasourceType.postgres) {
            delete advanced.statementTimeoutMs;
            delete advanced.idleInTxTimeoutMs;
        }

        return advanced;
    }

    private compactObject(input: Record<string, any>) {
        return Object.fromEntries(
            Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""),
        );
    }

    private getDefaultPort(type: DatasourceType) {
        switch (type) {
            case DatasourceType.mysql:
                return 3306;
            case DatasourceType.mssql:
                return 1433;
            case DatasourceType.postgres:
            default:
                return 5432;
        }
    }

    private toEnvPrefix(name: string) {
        return name.replace(/-/g, "_").toUpperCase();
    }

    private toDisplayName(name: string) {
        return name
            .split(/[-_]+/)
            .filter(Boolean)
            .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
            .join(" ");
    }

    private toPascalCase(name: string) {
        return name
            .split(/[-_]+/)
            .filter(Boolean)
            .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
            .join("");
    }

    private matchFirst(content: string, regex: RegExp) {
        return content.match(regex)?.[1];
    }

    private toBooleanOrNull(value?: string) {
        if (value === undefined) {
            return null;
        }
        if (value === "true") {
            return true;
        }
        if (value === "false") {
            return false;
        }
        return null;
    }

    private toNumberOrNull(value?: string) {
        if (value === undefined || value === "") {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
}

import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ISolidDatabaseModule } from 'src/interfaces';
import { DatasourceType } from 'src/dtos/create-model-metadata.dto';

interface McpCommandOptions {
    repoPath?: string;
    detached?: boolean;
}

@Command({
    name: 'mcp',
    description: 'Manage the SolidX MCP server and Celery worker docker containers (start/stop)',
})
export class McpCommand extends CommandRunner {
    private readonly logger = new Logger(McpCommand.name);

    constructor(
        private readonly solidRegistry: SolidRegistry
    ) {
        super();
    }

    async run(passedParams: string[], options?: McpCommandOptions): Promise<void> {
        const mode = (passedParams[0] || 'start').toLowerCase();

        if (mode === 'stop') {
            await this.stopContainers(options);
        } else if (mode === 'start') {
            await this.startContainers(options);
        } else {
            this.logger.error(
                `Unknown mode "${mode}". Supported modes are: start, stop.\n` +
                'Examples:\n' +
                '  solid mcp start -p ~/mcp/servers/solidx_mcp_server\n' +
                '  solid mcp stop  -p ~/mcp/servers/solidx_mcp_server\n'
            );
        }
    }

    // ---------------------------------------------------------------
    // START
    // ---------------------------------------------------------------
    private async startContainers(options?: McpCommandOptions): Promise<void> {
        // 1. Validate license key
        const apiKey = process.env.MCP_API_KEY;

        // Form the Database url to be used by the MCP server based on the consuming projects details. 
        const defaultDatabaseUser = process.env.DEFAULT_DATABASE_USER;
        const defaultDatabasePwd = process.env.DEFAULT_DATABASE_PASSWORD
            ? encodeURIComponent(process.env.DEFAULT_DATABASE_PASSWORD)
            : '';
        const defaultDatabaseHost = process.env.DEFAULT_DATABASE_HOST === 'localhost' ? 'host.docker.internal' : process.env.DEFAULT_DATABASE_HOST;
        const defaultDatabaseName = process.env.DEFAULT_DATABASE_NAME;
        const databaseDialect = process.env.DEFAULT_DATABASE_TYPE?.toLowerCase() === 'mssql' ? 'mssql+pyodbc' : 'postgresql';
        // const databaseUrl = `${databaseDialect}://${defaultDatabaseUser}:${defaultDatabasePwd}@${defaultDatabaseHost}/${defaultDatabaseName}`;

        const defaultDatasource: ISolidDatabaseModule = this.solidRegistry.getDefaultSolidDatabaseModule()

        let databaseUrl: string;
        if (defaultDatasource.type() === DatasourceType.mssql) {
            const base = `mssql+pyodbc://${defaultDatabaseUser}:${defaultDatabasePwd}@${defaultDatabaseHost}/${defaultDatabaseName}`;
            const driver = encodeURIComponent('ODBC Driver 18 for SQL Server');
            databaseUrl = `${base}?driver=${driver}&TrustServerCertificate=yes`;
        }
        if (defaultDatasource.type() === DatasourceType.postgres) {
            databaseUrl = `postgresql://${defaultDatabaseUser}:${defaultDatabasePwd}@${defaultDatabaseHost}/${defaultDatabaseName}`;
        }

        if (!apiKey || apiKey.trim() === '') {
            this.logger.error(
                '❌ MCP_API_KEY environment variable is missing.\n' +
                'Set it before running:\n' +
                '   export MCP_API_KEY="your_license_key"\n'
            );
            return;
        }

        this.logger.log('✔ MCP_API_KEY found.');

        // 2. Resolve paths
        const repoPath = options?.repoPath ? this.resolvePath(options.repoPath) : process.cwd();
        const consumingProjectPath = path.resolve(process.cwd(), '..');
        const composeFile = path.join(repoPath, 'docker-compose.yml');

        if (!fs.existsSync(composeFile)) {
            this.logger.error(`docker-compose.yml not found at ${composeFile}`);
            return;
        }

        const detached = options?.detached ?? false;

        this.logger.log(`Mode: start`);
        this.logger.log(`Using repo path: ${repoPath}`);
        this.logger.log(`Detached mode: ${detached}`);
        this.logger.log(`Consuming project root: ${consumingProjectPath}`);

        // 3. Build docker compose args
        const cmd = 'docker';
        const args = ['compose', '-f', composeFile, 'up'];

        if (detached) {
            args.push('-d');
        }

        // Service names as defined in docker-compose.yml
        args.push('mcp_server', 'mcp_celery_worker');

        const env: NodeJS.ProcessEnv = {
            ...process.env,
            MCP_API_KEY: apiKey,
            HOST_SOLIDX_CONSUMING_PROJECT_ROOT: consumingProjectPath,
            DATABASE_URL: databaseUrl,
        };

        this.logger.log(`Running: ${cmd} ${args.join(' ')}`);
        // const envLog = Object.entries(env)
        //     .map(([key, value]) => `${key}=${value ?? ''}`)
        //     .join('\n');
        // this.logger.log(`Using env overrides:\n${envLog}`);

        await this.runDockerCommand(cmd, args, repoPath, env);

        this.logger.log(
            detached
                ? 'MCP containers started in detached mode.'
                : 'MCP containers started in foreground.'
        );
    }

    // ---------------------------------------------------------------
    // STOP
    // ---------------------------------------------------------------
    private async stopContainers(options?: McpCommandOptions): Promise<void> {
        const repoPath = options?.repoPath ? this.resolvePath(options.repoPath) : process.cwd();
        const composeFile = path.join(repoPath, 'docker-compose.yml');

        if (!fs.existsSync(composeFile)) {
            this.logger.error(`docker-compose.yml not found at ${composeFile}`);
            return;
        }

        this.logger.log(`Mode: stop`);
        this.logger.log(`Using repo path: ${repoPath}`);

        const cmd = 'docker';
        const args = ['compose', '-f', composeFile, 'down'];

        this.logger.log(`Running: ${cmd} ${args.join(' ')}`);

        await this.runDockerCommand(cmd, args, repoPath, process.env);

        this.logger.log('MCP containers stopped (docker compose down).');
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------
    private resolvePath(inputPath: string): string {
        if (inputPath.startsWith('~')) {
            return path.join(process.env.HOME!, inputPath.slice(1));
        }
        return path.resolve(inputPath);
    }

    private runDockerCommand(
        cmd: string,
        args: string[],
        cwd: string,
        env: NodeJS.ProcessEnv,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn(cmd, args, {
                cwd,
                env,
                stdio: 'inherit',
            });

            child.on('error', (err) => {
                this.logger.error(`Docker error: ${err.message}`);
                reject(err);
            });

            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Docker exited with code ${code}`));
            });
        });
    }

    // Flags

    @Option({
        flags: '-d, --detached [boolean]',
        description: 'Run containers in detached mode (only for start, default: false)',
        required: false,
    })
    parseDetached(val: string): boolean {
        if (val === undefined) return false;
        return val === 'true' || val === '1';
    }

    @Option({
        flags: '-p, --repo-path [path]',
        description: 'Path to the SolidX MCP Server repo containing docker-compose.yml',
        required: false,
    })
    parseRepoPath(val: string): string {
        return val;
    }
}

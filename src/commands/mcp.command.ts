import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface McpCommandOptions {
    repoPath?: string;
    detached?: boolean;
}

@Command({
    name: 'mcp',
    description: 'Start the SolidX MCP server and Celery worker docker containers',
})
export class McpCommand extends CommandRunner {
    private readonly logger = new Logger(McpCommand.name);

    constructor() {
        super();
    }

    async run(passedParams: string[], options?: McpCommandOptions): Promise<void> {

        // ---------------------------------------------------------------
        // 1. Validate license key
        // ---------------------------------------------------------------
        const apiKey = process.env.MCP_API_KEY;

        if (!apiKey || apiKey.trim() === '') {
            this.logger.error(
                '❌ MCP_API_KEY environment variable is missing.\n' +
                'Set it before running:\n' +
                '   export MCP_API_KEY="your_license_key"\n'
            );
            return;
        }

        this.logger.log('✔ MCP_API_KEY found.');

        // ---------------------------------------------------------------
        // 2. Resolve repo path
        // ---------------------------------------------------------------
        const repoPath = options?.repoPath ? this.resolvePath(options.repoPath) : process.cwd();
        const consumingProjectPath = path.resolve(process.cwd(), '..');

        const composeFile = path.join(repoPath, 'docker-compose.yml');

        if (!fs.existsSync(composeFile)) {
            this.logger.error(`docker-compose.yml not found at ${composeFile}`);
            return;
        }

        const detached = options?.detached ?? false;

        this.logger.log(`Using repo path: ${repoPath}`);
        this.logger.log(`Detached mode: ${detached}`);

        // ---------------------------------------------------------------
        // 3. Build docker compose args
        // ---------------------------------------------------------------
        const cmd = 'docker';
        const args = ['compose', '-f', composeFile, 'up'];

        if (detached) {
            args.push('-d');
        }

        args.push('mcp_server', 'mcp_celery_worker');

        const env = {
            ...process.env,                   // preserve existing env
            MCP_API_KEY: apiKey,              // pass to docker process
            HOST_SOLIDX_CONSUMING_PROJECT_ROOT: consumingProjectPath,
        }

        this.logger.log(`Running: ${cmd} ${args.join(' ')}`);
        this.logger.log(`Using env: ${JSON.stringify(env)}`);

        // ---------------------------------------------------------------
        // 4. Run docker with environment variable passed along
        // ---------------------------------------------------------------
        await this.runDockerCommand(cmd, args, repoPath, env);

        this.logger.log(detached ? 'MCP containers started in detached mode.' : 'MCP containers started in foreground.');
    }

    // Resolve ~ and relative paths
    private resolvePath(inputPath: string): string {
        if (inputPath.startsWith('~')) {
            return path.join(process.env.HOME!, inputPath.slice(1));
        }
        return path.resolve(inputPath);
    }

    private runDockerCommand(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
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
        description: 'Run containers in detached mode (default: true)',
        required: false,
    })
    parseDetached(val: string): boolean {
        if (val === undefined) return true;
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

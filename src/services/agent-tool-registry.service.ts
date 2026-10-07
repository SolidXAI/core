import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { SecretService } from './secret.service';
import { AgentTool } from '../entities/agent-tool.entity';
import { AgentConfigCatalogService } from './agent-config-version.service';
import { AgentToolRegistry } from '../entities/agent-tool-registry.entity';
import { AgentToolRegistryRepository } from '../repository/agent-tool-registry.repository';
import { CreateAgentToolRegistryDto } from '../dtos/create-agent-tool-registry.dto';
import { UpdateAgentToolRegistryDto } from '../dtos/update-agent-tool-registry.dto';

@Injectable()
export class AgentToolRegistryService extends AgentConfigCatalogService<AgentToolRegistry>{
  private readonly logger = new Logger(AgentToolRegistryService.name);

  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentToolRegistryRepository,
    readonly moduleRef: ModuleRef,
    readonly secretService: SecretService,
  ) {
   super(entityManager, repo, 'agentToolRegistry', moduleRef, AgentTool, 'agentToolRegistry');
 }

  private withChecksum<T extends { type?: string; sourceCode?: string; checksum?: string }>(dto: T, existing?: AgentToolRegistry): T {
    if (!['custom', 'thirdparty'].includes(dto.type ?? existing?.type)) return dto;

    const sourceCode = dto.sourceCode ?? existing?.sourceCode;
    if (typeof sourceCode !== 'string') return dto;

    return {
      ...dto,
      checksum: createHash('sha256').update(sourceCode, 'utf8').digest('hex'),
    };
  }

  private lifecycleRunner(): { python: string; runtimeRoot: string; sourceRoot?: string } {
    const binary = process.platform === 'win32' ? 'python.exe' : 'python';
    const configuredSourceRoot = process.env.SOLIDX_AGENTHUB_RUNTIME_PATH;
    const sourceRoot = configuredSourceRoot
      && existsSync(join(configuredSourceRoot, 'src', 'agenthub', 'tools', 'tool_lifecycle_check.py'))
      ? configuredSourceRoot
      : undefined;
    const solidxVenv = { root: join(homedir(), '.solidx', 'agenthub-venv'), sourceRoot };
    const localVenv = process.env.SOLIDX_AGENTHUB_RUNTIME_PATH
      ? { root: join(process.env.SOLIDX_AGENTHUB_RUNTIME_PATH, '.venv'), sourceRoot }
      : undefined;
    const preference = process.env.SOLIDX_AGENTHUB_RUNTIME_PREFERENCE?.trim().toLowerCase() || 'solidx';
    if (preference !== 'solidx' && preference !== 'local') {
      throw new ServiceUnavailableException('SOLIDX_AGENTHUB_RUNTIME_PREFERENCE must be "solidx" or "local".');
    }
    const candidates = (preference === 'local' ? [localVenv, solidxVenv] : [solidxVenv, localVenv])
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined);
    for (const candidate of candidates) {
      const python = join(candidate.root, process.platform === 'win32' ? 'Scripts' : 'bin', binary);
      if (existsSync(python)) return { python, runtimeRoot: candidate.root, sourceRoot: candidate.sourceRoot };
    }
    throw new ServiceUnavailableException('AgentHub runtime virtual environment was not found.');
  }

  private async runLifecycleScript(request: Record<string, unknown>): Promise<Record<string, any>> {
    const runner = this.lifecycleRunner();
    const requestJson = JSON.stringify(request);
    const childEnv = {
      PATH: process.env.PATH ?? '',
      VIRTUAL_ENV: runner.runtimeRoot,
      HOME: homedir(),
      DATABASE_URL: process.env.DATABASE_URL,
      ...(process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {}),
      ...(runner.sourceRoot ? { PYTHONPATH: join(runner.sourceRoot, 'src') } : {}),
    };
    return new Promise((resolve, reject) => {
      const child = spawn(runner.python, ['-m', 'agenthub.tools.tool_lifecycle_check'], {
        cwd: runner.sourceRoot ?? tmpdir(),
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        finish(() => reject(new ServiceUnavailableException('Tool check exceeded the 20 second limit.')));
      }, 20_000);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        if (stdout.length > 2_000_000) child.kill('SIGKILL');
      });
      child.stderr.on('data', (chunk: string) => {
        if (stderr.length < 2_000_000) stderr += chunk.slice(0, 2_000_000 - stderr.length);
      });
      child.on('error', (error) => finish(() => reject(new ServiceUnavailableException(`Could not start AgentHub tool checker: ${error.message}`))));
      child.on('close', (code) => finish(() => {
        if (stdout.length > 2_000_000) {
          reject(new BadRequestException('Tool check response was too large.'));
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid response');
          resolve(result);
        } catch {
          reject(new ServiceUnavailableException(`AgentHub tool checker returned an invalid response${code === 0 ? '' : ` (exit ${code})`}. ${stderr.slice(0, 500)}`));
        }
      }));
      child.stdin.end(requestJson);
    });
  }

  private async readToolConfig(tool: AgentToolRegistry, checksum: string): Promise<{ success: boolean; message: string; requiredSecrets: string[] }> {
    const result = await this.runLifecycleScript({ tool_id: tool.id, checksum, phase: 'config' });
    const requiredSecrets = result.required_secrets;
    if (result.success !== true || !Array.isArray(requiredSecrets)
        || requiredSecrets.some((key) => typeof key !== 'string' || !key.trim())
        || new Set(requiredSecrets).size !== requiredSecrets.length) {
      return { success: false, message: String(result.message ?? 'The tool returned an invalid configuration.'), requiredSecrets: [] };
    }
    return { success: true, message: String(result.message ?? 'Configuration declaration checked.'), requiredSecrets };
  }

  async checkTool(id: number, phase: string, checksum: string) {
    if (phase !== 'config' && phase !== 'init') throw new BadRequestException('Phase must be config or init.');
    const tool = await this.repo.findOne({ where: { id } });
    if (!tool) throw new NotFoundException(`Tool ${id} was not found.`);
    if (!['custom', 'thirdparty'].includes(tool.type)) throw new BadRequestException('Only custom and third-party tools can be checked.');
    const currentChecksum = createHash('sha256').update(tool.sourceCode ?? '', 'utf8').digest('hex');
    if (!checksum || checksum !== currentChecksum) throw new ConflictException('Tool source changed. Save the tool again before running checks.');

    const config = await this.readToolConfig(tool, currentChecksum);
    if (!config.success) {
      return {
        toolId: id, checksum, phase,
        config: { status: 'failed', message: config.message, requiredSecrets: [], missingSecrets: [] },
        init: { status: 'skipped', message: 'Configuration must pass before initialization can run.' },
      };
    }

    const resolvedSecrets = phase === 'init'
      ? await this.secretService.resolveAvailable(config.requiredSecrets)
      : undefined;
    const available = phase === 'config'
      ? await this.secretService.findAvailableKeys(config.requiredSecrets)
      : Object.keys(resolvedSecrets ?? {});
    const missingSecrets = config.requiredSecrets.filter((key) => !available.includes(key));
    const configStep = {
      status: missingSecrets.length ? 'failed' : 'passed',
      message: missingSecrets.length ? 'Configure all required active secrets before initializing this tool.' : config.message,
      requiredSecrets: config.requiredSecrets,
      missingSecrets,
    };
    if (missingSecrets.length || phase === 'config') {
      return {
        toolId: id, checksum, phase, config: configStep,
        init: { status: 'skipped', message: missingSecrets.length ? 'Required secrets must be configured first.' : 'Run initialization after configuration passes.' },
      };
    }

    const secretValues = Object.fromEntries(Object.entries(resolvedSecrets ?? {}).map(([key, value]) => [
      key, typeof value === 'string' ? value : JSON.stringify(value),
    ]));
    const init = await this.runLifecycleScript({
      tool_id: id, checksum, phase: 'init', secret_values: secretValues,
    });
    return {
      toolId: id, checksum, phase, config: configStep,
      init: { status: init.success === true ? 'passed' : 'failed', message: String(init.message ?? (init.success ? 'Initialization check passed.' : 'Initialization check failed.')) },
    };
  }

  override async create(createDto: CreateAgentToolRegistryDto, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<AgentToolRegistry> {
    return super.create(this.withChecksum({ ...createDto, status: 'inactive', lastLoadError: null }), files, solidRequestContext);
  }

  override async createMany(createDtos: CreateAgentToolRegistryDto[], solidRequestContext: any = {}): Promise<AgentToolRegistry[]> {
    return super.createMany(createDtos.map((dto) => this.withChecksum({ ...dto, status: 'inactive', lastLoadError: null })), solidRequestContext);
  }

  override async insertMany(createDtos: CreateAgentToolRegistryDto[], filesArray: Express.Multer.File[][] = [], solidRequestContext: any = {}): Promise<AgentToolRegistry[]> {
    return super.insertMany(createDtos.map((dto) => this.withChecksum({ ...dto, status: 'inactive', lastLoadError: null })), filesArray, solidRequestContext);
  }

  override async update(
    id: number,
    updateDto: UpdateAgentToolRegistryDto,
    files: Express.Multer.File[] = [],
    isPartialUpdate = false,
    solidRequestContext: any = {},
    isUpdate = false,
  ): Promise<AgentToolRegistry> {
    const existing = await this.repo.findOne({ where: { id } });
    const changed = existing && ['sourceCode', 'name', 'type'].some(
      (key) => updateDto[key] !== undefined && updateDto[key] !== existing[key],
    );
    if (!changed && updateDto.status === 'active' && existing?.status !== 'active'
        && existing && ['custom', 'thirdparty'].includes(existing.type)) {
      const checkedChecksum = createHash('sha256').update(existing.sourceCode ?? '', 'utf8').digest('hex');
      if (updateDto.checksum !== checkedChecksum) {
        throw new ConflictException('Tool source changed after checks. Run configuration and initialization again.');
      }
    }
    const dto = changed ? { ...updateDto, status: 'inactive', lastLoadError: null } : updateDto;
    return super.update(id, this.withChecksum(dto, existing ?? undefined), files, isPartialUpdate, solidRequestContext, isUpdate);
  }


}

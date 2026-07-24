import { BadRequestException, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

const fullWidthField = {
  layout: {
    width: 'full',
  },
};

type DockerRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

@WorkflowNodeProvider({
  type: 'runtime.python',
  kind: 'task',
  version: '1.0.0',
  category: 'runtime',
  subcategory: 'python',
  label: 'Runtime Python',
  description:
    'Runs arbitrary Python code inside a transient Docker container and exposes stdout, stderr, exit code, and parsed JSON output.',
  tags: ['runtime', 'python', 'docker', 'script'],
  aliases: ['python.run', 'python.script'],
  configSchema: {
    type: 'object',
    required: ['script'],
    properties: {
      image: { type: 'string', default: 'python:3.11-slim' },
      script: { type: 'string' },
      requirementsTxt: { type: 'string' },
      arguments: { type: 'object', default: {} },
      timeoutMs: { type: 'number', default: 120000 },
      networkMode: { type: 'string', default: 'bridge' },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      exitCode: { type: 'number' },
      stdout: { type: 'string' },
      stderr: { type: 'string' },
      result: {},
      arguments: { type: 'object' },
      image: { type: 'string' },
      timedOut: { type: 'boolean' },
    },
  },
  examples: [
    {
      key: 'parse-json-stdout',
      label: 'Return JSON from Python',
      language: 'yaml',
      configurationOnly: true,
      snippet:
        'image: python:3.11-slim\narguments:\n  name: "{{ inputs.name }}"\nscript: |\n  import json\n  from pathlib import Path\n\n  args = json.loads(Path("arguments.json").read_text())\n  print(json.dumps({"message": f"Hello {args[\'name\']}"}))\n',
    },
    {
      key: 'download-csv-with-pandas',
      label: 'Download and parse CSV',
      language: 'yaml',
      configurationOnly: true,
      snippet:
        'image: python:3.11-slim\nrequirementsTxt: |\n  pandas==2.2.2\n  requests==2.32.3\narguments:\n  fileUrl: "{{ inputs.fileUrl }}"\nscript: |\n  import json\n  import pandas as pd\n  from pathlib import Path\n\n  args = json.loads(Path("arguments.json").read_text())\n  rows = pd.read_csv(args["fileUrl"]).fillna("").to_dict(orient="records")\n  print(json.dumps({"rows": rows}))\n',
    },
  ],
  authoring: {
    defaultConfiguration: {
      image: 'python:3.11-slim',
      arguments: {},
      timeoutMs: 120000,
      networkMode: 'bridge',
    },
    configurationLayout: {
      type: 'tabs',
      tabs: [
        {
          key: 'runtime',
          label: 'Runtime',
          groups: ['Runtime'],
        },
        {
          key: 'arguments',
          label: 'Arguments',
          groups: ['Inputs'],
        },
        {
          key: 'script',
          label: 'Script',
          fields: ['script'],
        },
        {
          key: 'requirements',
          label: 'Requirements',
          fields: ['requirementsTxt'],
        },
      ],
    },
    configurationFields: [
      {
        key: 'image',
        label: 'Docker Image',
        description: 'Python Docker image used for execution.',
        valueType: 'string',
        defaultValue: 'python:3.11-slim',
        expressionAllowed: true,
        group: 'Runtime',
        uiSchema: fullWidthField,
      },
      {
        key: 'script',
        label: 'Python Script',
        description:
          'Python code to run. The node writes interpolated arguments to arguments.json in the container working directory.',
        valueType: 'string',
        required: true,
        expressionAllowed: true,
        group: 'Script',
        widgetHint: 'raw-editor',
        uiSchema: {
          ...fullWidthField,
          editor: {
            language: 'python',
            height: 'min(560px, calc(90vh - 330px))',
          },
        },
      },
      {
        key: 'requirementsTxt',
        label: 'requirements.txt',
        description:
          'Optional pip requirements installed before the script runs.',
        valueType: 'string',
        group: 'Script',
        widgetHint: 'raw-editor',
        uiSchema: {
          ...fullWidthField,
          editor: {
            language: 'text',
            height: 'min(420px, calc(90vh - 330px))',
          },
        },
      },
      {
        key: 'arguments',
        label: 'Arguments',
        description:
          'Optional JSON object. Expressions are interpolated before being written to arguments.json.',
        valueType: 'object',
        expressionAllowed: true,
        group: 'Inputs',
        widgetHint: 'json-editor',
        uiSchema: {
          ...fullWidthField,
          editor: {
            height: 'min(420px, calc(90vh - 330px))',
          },
        },
      },
      {
        key: 'timeoutMs',
        label: 'Timeout (ms)',
        description: 'Maximum runtime before the Docker container is stopped.',
        valueType: 'number',
        defaultValue: 120000,
        group: 'Runtime',
        uiSchema: fullWidthField,
      },
      {
        key: 'networkMode',
        label: 'Network Mode',
        description:
          'Docker network mode. Use bridge for remote downloads; use none to block network access.',
        valueType: 'string',
        defaultValue: 'bridge',
        enumValues: ['bridge', 'none', 'host'],
        group: 'Runtime',
        uiSchema: fullWidthField,
      },
    ],
    outputs: [
      {
        key: 'ok',
        label: 'OK',
        valueType: 'boolean',
        path: 'ok',
      },
      {
        key: 'result',
        label: 'Parsed JSON Result',
        description:
          'Parsed stdout when the script prints valid JSON. Otherwise null.',
        valueType: 'any',
        path: 'result',
      },
      {
        key: 'stdout',
        label: 'stdout',
        valueType: 'string',
        path: 'stdout',
      },
      {
        key: 'stderr',
        label: 'stderr',
        valueType: 'string',
        path: 'stderr',
      },
      {
        key: 'exitCode',
        label: 'Exit Code',
        valueType: 'integer',
        path: 'exitCode',
      },
    ],
    supportsExpressions: true,
    supportsRetryPolicy: true,
    supportsTimeoutMs: true,
    supportsOnError: true,
    supportsDisableToggle: true,
    supportsName: true,
    supportsDescription: true,
    searchableText: ['runtime', 'python', 'docker', 'script', 'pandas', 'csv'],
  },
  runtime: {
    emitsLogs: true,
    emitsArtifacts: false,
    deterministicOutputs: false,
    executionMode: 'task',
    successStatuses: ['success'],
  },
  documentation: {
    summary:
      'Executes Python code in Docker. Scripts can read arguments.json and should print JSON when downstream nodes need structured output.',
  },
  ui: {
    icon: 'si-code',
    iconColor: '#2563eb',
    iconBackgroundColor: '#dbeafe',
    iconBorderColor: '#bfdbfe',
    defaultEditorMode: 'schema',
    modalSize: 'xl',
    layoutHints: {
      preferredPanel: 'flow',
      groupOrder: ['Runtime', 'Inputs', 'Script'],
      stickySummary: true,
    },
  },
})
export class RuntimePythonNode implements WorkflowNodeHandler {
  private readonly logger = new Logger(RuntimePythonNode.name);

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.expression.interpolate(
      context.node.configuration ?? {},
      context,
    );

    const script = String(configuration.script ?? '').trim();
    if (!script) {
      throw new BadRequestException('runtime.python requires configuration.script.');
    }

    const image = String(configuration.image ?? 'python:3.11-slim').trim();
    const networkMode = this.normalizeNetworkMode(configuration.networkMode);
    const timeoutMs = Number(configuration.timeoutMs ?? context.node.timeoutMs ?? 120000);
    const argumentsValue =
      configuration.arguments &&
      typeof configuration.arguments === 'object' &&
      !Array.isArray(configuration.arguments)
        ? configuration.arguments
        : {};

    const workspacePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'solidx-runtime-python-'),
    );
    const hasRequirements = String(configuration.requirementsTxt ?? '').trim().length > 0;

    await context.emitLog({
      level: 'debug',
      eventType: 'node.runtime.python.workspace.created',
      source: 'runtime.python',
      message: `Prepared temporary Python runtime workspace.`,
      metadata: {
        workspacePath,
        image,
        networkMode,
        timeoutMs,
        argumentKeys: Object.keys(argumentsValue),
        hasRequirements,
        scriptBytes: this.byteLength(script),
        requirementsBytes: hasRequirements
          ? this.byteLength(String(configuration.requirementsTxt))
          : 0,
      },
    });

    try {
      await this.writeRuntimeFiles(workspacePath, {
        script,
        requirementsTxt: configuration.requirementsTxt,
        argumentsValue,
      });

      await context.emitLog({
        level: 'debug',
        eventType: 'node.runtime.python.files.written',
        source: 'runtime.python',
        message: `Wrote Python runtime files.`,
        metadata: {
          files: [
            'script.py',
            'arguments.json',
            ...(hasRequirements ? ['requirements.txt'] : []),
          ],
          argumentKeys: Object.keys(argumentsValue),
        },
      });

      await context.emitLog({
        level: 'info',
        eventType: 'node.runtime.python.started',
        source: 'runtime.python',
        message: `Starting Docker container for Python runtime using ${image}.`,
        metadata: {
          image,
          networkMode,
          timeoutMs,
          hasRequirements,
        },
      });

      this.logger.log(
        `Starting runtime.python Docker container for node ${context.node.id} using image ${image} (network=${networkMode}, timeoutMs=${timeoutMs}).`,
      );
      const runResult = await this.runDockerPython({
        workspacePath,
        image,
        networkMode,
        timeoutMs,
        onStarted: async (pid) => {
          await context.emitLog({
            level: 'debug',
            eventType: 'node.runtime.python.docker.started',
            source: 'runtime.python',
            message: `Docker process started for Python runtime.`,
            metadata: {
              pid,
              image,
              networkMode,
            },
          });
        },
      });

      const parsedResult = this.parseJsonOutput(runResult.stdout);
      const ok = runResult.exitCode === 0 && !runResult.timedOut;

      await context.emitLog({
        level: ok ? 'info' : 'warn',
        eventType: 'node.runtime.python.completed',
        source: 'runtime.python',
        message: `Python runtime exited with code ${runResult.exitCode ?? 'unknown'}.`,
        metadata: {
          exitCode: runResult.exitCode,
          timedOut: runResult.timedOut,
          stdoutBytes: this.byteLength(runResult.stdout),
          stderrBytes: this.byteLength(runResult.stderr),
          parsedJsonOutput: parsedResult !== null,
          stderrPreview: ok ? undefined : this.preview(runResult.stderr),
        },
      });

      if (!ok) {
        this.logger.warn(
          `runtime.python node ${context.node.id} exited unsuccessfully: code=${runResult.exitCode} timedOut=${runResult.timedOut} stderrBytes=${this.byteLength(runResult.stderr)}.`,
        );
        throw new BadRequestException(
          runResult.timedOut
            ? `runtime.python timed out after ${timeoutMs} ms.`
            : `runtime.python failed with exit code ${runResult.exitCode}.`,
        );
      }

      this.logger.log(
        `runtime.python node ${context.node.id} completed successfully: stdoutBytes=${this.byteLength(runResult.stdout)} stderrBytes=${this.byteLength(runResult.stderr)}.`,
      );

      return {
        output: {
          ok,
          exitCode: runResult.exitCode,
          stdout: runResult.stdout,
          stderr: runResult.stderr,
          result: parsedResult,
          arguments: argumentsValue,
          image,
          timedOut: runResult.timedOut,
        },
      };
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
      await context.emitLog({
        level: 'debug',
        eventType: 'node.runtime.python.workspace.removed',
        source: 'runtime.python',
        message: `Removed temporary Python runtime workspace.`,
        metadata: {
          workspacePath,
        },
      });
    }
  }

  private async writeRuntimeFiles(
    workspacePath: string,
    options: {
      script: string;
      requirementsTxt?: string;
      argumentsValue: Record<string, any>;
    },
  ) {
    await fs.writeFile(path.join(workspacePath, 'script.py'), options.script, 'utf8');
    await fs.writeFile(
      path.join(workspacePath, 'arguments.json'),
      JSON.stringify(options.argumentsValue, null, 2),
      'utf8',
    );

    if (String(options.requirementsTxt ?? '').trim()) {
      await fs.writeFile(
        path.join(workspacePath, 'requirements.txt'),
        String(options.requirementsTxt),
        'utf8',
      );
    }
  }

  private runDockerPython(options: {
    workspacePath: string;
    image: string;
    networkMode: string;
    timeoutMs: number;
    onStarted?: (pid?: number) => void | Promise<void>;
  }): Promise<DockerRunResult> {
    return new Promise((resolve, reject) => {
      const command =
        'if [ -s requirements.txt ]; then python -m pip install --disable-pip-version-check -q -r requirements.txt; fi; python script.py';

      const child = spawn('docker', [
        'run',
        '--rm',
        '--network',
        options.networkMode,
        '-v',
        `${options.workspacePath}:/workspace`,
        '-w',
        '/workspace',
        options.image,
        'sh',
        '-lc',
        command,
      ]);

      void Promise.resolve(options.onStarted?.(child.pid)).catch((error) => {
        this.logger.warn(
          `Unable to emit runtime.python Docker start log: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, options.timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error: any) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(
          new BadRequestException(
            error?.code === 'ENOENT'
              ? 'runtime.python requires Docker to be installed and available on PATH.'
              : error?.message ?? 'Unable to start runtime.python Docker process.',
          ),
        );
      });

      child.on('close', (exitCode) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode,
          stdout,
          stderr,
          timedOut,
        });
      });
    });
  }

  private normalizeNetworkMode(value: any) {
    const networkMode = String(value ?? 'bridge').trim() || 'bridge';
    if (!['bridge', 'none', 'host'].includes(networkMode)) {
      throw new BadRequestException(
        'runtime.python networkMode must be bridge, none, or host.',
      );
    }
    return networkMode;
  }

  private parseJsonOutput(stdout: string) {
    const trimmed = stdout.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  private byteLength(value: string) {
    return Buffer.byteLength(value ?? '', 'utf8');
  }

  private preview(value: string, maxLength = 2000) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.length > maxLength
      ? `${trimmed.slice(0, maxLength)}...`
      : trimmed;
  }
}

import { BadRequestException } from '@nestjs/common';
import { WorkflowNodeProvider } from '../../../decorators/workflow-node-provider.decorator';
import { WorkflowNodeHandler } from '../../../interfaces/workflow-node-handler.interface';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeHandlerResult,
} from '../../../types/workflow-dsl.types';

type LoopUntilCheckFrequency = {
  interval?: string | number;
  maxIterations?: string | number;
  maxDuration?: string | number;
  failOnMaxReached?: boolean | string;
};

@WorkflowNodeProvider({
  type: 'loopUntil',
  kind: 'control',
  category: 'control-flow',
  label: 'Loop Until',
  description: 'Runs child nodes repeatedly until a condition evaluates true.',
  tags: ['loop', 'iteration', 'condition', 'polling'],
  authoring: {
    defaultConfiguration: {
      condition: '{{ outputs.checkStatus.ready == true }}',
      checkFrequency: {
        interval: 'PT1M',
        failOnMaxReached: false,
      },
    },
    configurationLayout: {
      type: 'tabs',
      tabs: [
        {
          key: 'condition',
          label: 'Condition',
          groups: ['Condition'],
        },
        {
          key: 'guardrails',
          label: 'Guardrails',
          groups: ['Guardrails'],
        },
      ],
    },
    configurationFields: [
      {
        key: 'condition',
        label: 'Condition',
        description:
          'Boolean expression evaluated after each loop iteration. It can read outputs from the latest child-node run.',
        valueType: 'expression',
        required: true,
        expressionAllowed: true,
        widgetHint: 'textarea',
        group: 'Condition',
        uiSchema: {
          layout: {
            width: 'full',
          },
        },
      },
      {
        key: 'checkFrequency',
        label: 'Check Frequency',
        description:
          'Optional loop guardrails: interval, maxIterations, maxDuration, and failOnMaxReached.',
        valueType: 'object',
        expressionAllowed: true,
        widgetHint: 'yaml-editor',
        group: 'Guardrails',
        uiSchema: {
          layout: {
            width: 'full',
          },
          editor: {
            height: 'min(320px, calc(90vh - 360px))',
          },
        },
      },
    ],
    childSlots: [
      {
        key: 'tasks',
        label: 'Loop Body',
        description: 'Nodes that run before the condition is evaluated.',
        kind: 'sequence',
        layout: 'sequential',
        required: true,
      },
      {
        key: 'errors',
        label: 'Errors',
        description: 'Nodes that run sequentially if this loop fails.',
        kind: 'sequence',
        layout: 'sequential',
      },
    ],
    outputs: [
      {
        key: 'iterationCount',
        label: 'Iteration Count',
        description: 'Number of loop body iterations that ran.',
        valueType: 'number',
        path: 'iterationCount',
      },
      {
        key: 'conditionMatched',
        label: 'Condition Matched',
        description: 'Whether the loop stopped because the condition evaluated true.',
        valueType: 'boolean',
        path: 'conditionMatched',
      },
    ],
    supportsDescription: true,
    supportsName: true,
  },
  documentation: {
    summary:
      'Runs the loop body, evaluates the condition, and repeats after the configured interval until the condition is true or a guardrail is reached.',
  },
  ui: {
    icon: 'si-repeat',
    iconColor: '#0f766e',
    iconBackgroundColor: '#ccfbf1',
    iconBorderColor: '#99f6e4',
    modalSize: 'lg',
    layoutHints: {
      groupOrder: ['Condition', 'Guardrails'],
    },
  },
})
export class LoopUntilNode implements WorkflowNodeHandler {
  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeHandlerResult> {
    const configuration = context.node.configuration ?? {};
    const condition = configuration.condition ?? configuration.expression;
    if (!condition) {
      throw new BadRequestException('loopUntil requires configuration.condition.');
    }

    const checkFrequency = this.resolveCheckFrequency(
      context.expression.interpolate(configuration.checkFrequency ?? {}, context),
    );
    const childNodes = context.node.tasks ?? [];
    const startedAt = Date.now();
    let iterationCount = 0;
    let conditionMatched = false;
    let maxReached = false;
    let latestChildOutputs: Record<string, any> = {};

    while (true) {
      iterationCount += 1;
      context.outputs[context.node.id] = {
        iterationCount,
        conditionMatched: false,
        maxReached: false,
      };

      const iterationOutputs = {
        ...(context.outputs ?? {}),
      };

      latestChildOutputs = await context.runNodes(childNodes, {
        outputs: iterationOutputs,
      });

      Object.assign(context.outputs, iterationOutputs);

      conditionMatched = context.expression.evaluateCondition(condition, {
        ...context,
        outputs: context.outputs,
      });

      context.outputs[context.node.id] = {
        iterationCount,
        conditionMatched,
        maxReached: false,
        latestOutputs: latestChildOutputs,
      };

      await context.emitLog({
        level: 'info',
        eventType: 'node.loopUntil.evaluated',
        source: 'loopUntil',
        message: `LoopUntil node "${context.node.id}" iteration ${iterationCount} evaluated to ${conditionMatched}.`,
        context: {
          condition,
          iterationCount,
          conditionMatched,
        },
      });

      if (conditionMatched) {
        break;
      }

      maxReached = this.hasReachedGuardrail(
        iterationCount,
        startedAt,
        checkFrequency,
      );
      if (maxReached) {
        if (checkFrequency.failOnMaxReached) {
          throw new BadRequestException(
            `loopUntil "${context.node.id}" reached its maximum check frequency guardrail before the condition matched.`,
          );
        }
        break;
      }

      if (checkFrequency.intervalMs > 0) {
        await this.delay(checkFrequency.intervalMs);
      }
    }

    return {
      output: {
        iterationCount,
        conditionMatched,
        maxReached,
        latestOutputs: latestChildOutputs,
      },
    };
  }

  private resolveCheckFrequency(value: any) {
    const checkFrequency: LoopUntilCheckFrequency =
      value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const maxIterations = this.optionalPositiveInteger(
      checkFrequency.maxIterations,
      'checkFrequency.maxIterations',
    );
    const maxDurationMs =
      checkFrequency.maxDuration === undefined ||
      checkFrequency.maxDuration === null ||
      checkFrequency.maxDuration === ''
        ? undefined
        : this.parseDurationMs(checkFrequency.maxDuration, 'checkFrequency.maxDuration');

    return {
      intervalMs: this.parseDurationMs(
        checkFrequency.interval ?? 'PT1M',
        'checkFrequency.interval',
      ),
      maxIterations,
      maxDurationMs,
      failOnMaxReached: this.resolveBoolean(checkFrequency.failOnMaxReached),
    };
  }

  private hasReachedGuardrail(
    iterationCount: number,
    startedAt: number,
    checkFrequency: {
      maxIterations?: number;
      maxDurationMs?: number;
    },
  ): boolean {
    return (
      (checkFrequency.maxIterations !== undefined &&
        iterationCount >= checkFrequency.maxIterations) ||
      (checkFrequency.maxDurationMs !== undefined &&
        Date.now() - startedAt >= checkFrequency.maxDurationMs)
    );
  }

  private optionalPositiveInteger(value: any, label: string): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new BadRequestException(`${label} must be a positive integer.`);
    }

    return Math.floor(parsed);
  }

  private parseDurationMs(value: any, label: string): number {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) {
        throw new BadRequestException(`${label} must be a non-negative duration.`);
      }
      return value;
    }

    const raw = String(value ?? '').trim();
    if (!raw) {
      return 0;
    }

    if (/^\d+$/.test(raw)) {
      return Number(raw);
    }

    const isoMatch = raw.match(
      /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
    );
    if (isoMatch) {
      const [, days, hours, minutes, seconds] = isoMatch;
      return (
        Number(days ?? 0) * 24 * 60 * 60 * 1000 +
        Number(hours ?? 0) * 60 * 60 * 1000 +
        Number(minutes ?? 0) * 60 * 1000 +
        Number(seconds ?? 0) * 1000
      );
    }

    const unitMatch = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
    if (unitMatch) {
      const amount = Number(unitMatch[1]);
      const unit = unitMatch[2].toLowerCase();
      const multiplier =
        unit === 'ms'
          ? 1
          : unit === 's'
            ? 1000
            : unit === 'm'
              ? 60 * 1000
              : unit === 'h'
                ? 60 * 60 * 1000
                : 24 * 60 * 60 * 1000;
      return amount * multiplier;
    }

    throw new BadRequestException(`${label} must be milliseconds, 1s/1m style, or ISO-8601 duration.`);
  }

  private resolveBoolean(value: any): boolean {
    if (value === true || value === 'true') {
      return true;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

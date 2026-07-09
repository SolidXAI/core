import { Injectable } from '@nestjs/common';
import {
  WorkflowExpressionResolver,
  WorkflowRuntimeContext,
} from '../../types/workflow-dsl.types';

@Injectable()
export class WorkflowExpressionService implements WorkflowExpressionResolver {
  interpolate<T = any>(value: T, context: WorkflowRuntimeContext): T {
    if (Array.isArray(value)) {
      return value.map((entry) => this.interpolate(entry, context)) as T;
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [key, entry]) => {
        acc[key] = this.interpolate(entry, context);
        return acc;
      }, {} as Record<string, any>) as T;
    }

    if (typeof value !== 'string') {
      return value;
    }

    const exactExpression = value.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
    if (exactExpression) {
      return this.resolveExpression(exactExpression[1], context);
    }

    return value.replace(/\{\{\s*(.*?)\s*\}\}/g, (_match, expression) => {
      const resolved = this.resolveExpression(expression, context);
      return resolved === null || resolved === undefined ? '' : String(resolved);
    }) as T;
  }

  evaluateCondition(expression: any, context: WorkflowRuntimeContext): boolean {
    const resolved =
      typeof expression === 'string'
        ? this.resolveExpression(this.unwrapExpression(expression), context)
        : expression;

    if (typeof resolved === 'string') {
      return this.evaluateBooleanExpression(resolved, context);
    }

    return Boolean(resolved);
  }

  resolveExpression(expression: string, context: WorkflowRuntimeContext): any {
    const trimmed = expression.trim();

    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (this.isQuoted(trimmed)) return trimmed.slice(1, -1);

    const comparison = this.evaluateComparison(trimmed, context);
    if (comparison !== undefined) {
      return comparison;
    }

    return this.resolvePath(trimmed, context);
  }

  private evaluateBooleanExpression(
    expression: string,
    context: WorkflowRuntimeContext,
  ): boolean {
    const orParts = this.splitTopLevel(expression, '||');
    if (orParts.length > 1) {
      return orParts.some((part) => this.evaluateCondition(part, context));
    }

    const andParts = this.splitTopLevel(expression, '&&');
    if (andParts.length > 1) {
      return andParts.every((part) => this.evaluateCondition(part, context));
    }

    const comparison = this.evaluateComparison(expression, context);
    if (comparison !== undefined) {
      return comparison;
    }

    return Boolean(this.resolveExpression(expression, context));
  }

  private evaluateComparison(
    expression: string,
    context: WorkflowRuntimeContext,
  ): boolean | undefined {
    const match = expression.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
    if (!match) {
      return undefined;
    }

    const left = this.resolveOperand(match[1], context);
    const operator = match[2];
    const right = this.resolveOperand(match[3], context);

    switch (operator) {
      case '===':
        return left === right;
      case '!==':
        return left !== right;
      case '==':
        return left == right;
      case '!=':
        return left != right;
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      default:
        return undefined;
    }
  }

  private resolveOperand(
    operand: string,
    context: WorkflowRuntimeContext,
  ): any {
    return this.resolveExpression(this.unwrapExpression(operand), context);
  }

  private resolvePath(path: string, context: WorkflowRuntimeContext): any {
    const root = {
      inputs: context.input,
      input: context.input,
      variables: context.variables,
      outputs: context.outputs,
      execution: context.execution,
      node: context.node,
      item: context.item,
      index: context.index,
    };

    const parts = path
      .replace(/\[(?:'|")([^'"]+)(?:'|")\]/g, '.$1')
      .split('.')
      .filter(Boolean);

    return parts.reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, root as any);
  }

  private unwrapExpression(expression: string): string {
    const match = expression.trim().match(/^\{\{\s*(.*?)\s*\}\}$/);
    return match ? match[1] : expression.trim();
  }

  private splitTopLevel(expression: string, token: string): string[] {
    return expression
      .split(token)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private isQuoted(value: string): boolean {
    return (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    );
  }
}

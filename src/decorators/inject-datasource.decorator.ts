// inject-datasource.decorator.ts
import { Inject } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';

export function InjectDataSource(connectionName?: string): ParameterDecorator {
  return Inject(getDataSourceToken(connectionName));
}
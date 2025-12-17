import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ComputedFieldProvider } from 'src/decorators/computed-field-provider.decorator';
import { CommonEntity } from 'src/entities/common.entity';
import { ComputedFieldMetadata } from 'src/helpers/solid-registry';
import { IEntityPreComputeFieldProvider } from 'src/interfaces';
import { EntityManager } from 'typeorm';
import { get } from "lodash";
export interface AlphaNumExternalIdContext {
  prefix?: string;              // alias -> staticPrefix
  length?: number;              // Optional: length of the unique code to generate, default is 5
  dynamicFieldPrefix?: string;  // NEW: field name on the entity
}

@ComputedFieldProvider()
@Injectable()
export class AlphaNumExternalIdComputationProvider<T extends CommonEntity> implements IEntityPreComputeFieldProvider<T, AlphaNumExternalIdContext> {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager
  ) { }

  name(): string {
    return this.constructor.name;
  }

  help(): string {
    return 'Provider used to compute external ID for a CommonEntity with support for static or dynamic prefix.';
  }

  async preComputeValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<AlphaNumExternalIdContext>
  ) {
    const { prefix, length, dynamicFieldPrefix } =
      computedFieldMetadata.computedFieldValueProviderCtxt;

    const codeLength = length || 5;

    // Determine prefix
    let resolvedPrefix = prefix || '';

    if (dynamicFieldPrefix) {
      const dynamicValue = get(triggerEntity as any, dynamicFieldPrefix);
      if (dynamicValue) {
        resolvedPrefix = String(dynamicValue).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      }
    }

    const uniqueCode = await this.generateUniqueExternalId(resolvedPrefix, codeLength, triggerEntity, computedFieldMetadata.fieldName);
    const finalExternalId = resolvedPrefix ? `${resolvedPrefix}-${uniqueCode}` : uniqueCode;

    triggerEntity[computedFieldMetadata.fieldName] = finalExternalId;
  }

  private generateRandomCode(length = 5): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async isExternalIdUnique(externalId: string, triggerEntity: T, fieldName: string): Promise<boolean> {
    const count = await this.entityManager.count(triggerEntity.constructor as any,
      {
        where: { [fieldName]: externalId },
      }
    );
    return count === 0;
  }

  private async generateUniqueExternalId(resolvedPrefix: string, codeLength: number, triggerEntity: T, fieldName: string): Promise<string> {
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {

      const newId = this.generateRandomCode(codeLength);

      const fullId = resolvedPrefix ? `${resolvedPrefix}-${newId}` : newId;

      const isUnique = await this.isExternalIdUnique(fullId, triggerEntity, fieldName);

      if (isUnique) {
        return newId;
      }
    }

    throw new Error('Failed to generate a unique external ID after multiple attempts');
  }
}

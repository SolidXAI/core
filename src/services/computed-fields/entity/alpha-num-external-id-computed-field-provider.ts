import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ComputedFieldProvider } from 'src/decorators/computed-field-provider.decorator';
import { CommonEntity } from 'src/entities/common.entity';
import { ComputedFieldMetadata } from 'src/helpers/solid-registry';
import { IEntityPreComputeFieldProvider } from 'src/interfaces';
import { EntityManager } from 'typeorm';

export interface AlphaNumExternalIdContext {
  prefix: string; // The prefix to use for the external ID
  length?: number; // Optional: length of the unique code to generate, default is 5
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
    return 'Provider used to compute external ID for a CommonEntity.';
  }

  async preComputeValue(triggerEntity: T, computedFieldMetadata: ComputedFieldMetadata<AlphaNumExternalIdContext>) {
    const prefix = computedFieldMetadata.computedFieldValueProviderCtxt.prefix;
    const codeLength = computedFieldMetadata.computedFieldValueProviderCtxt.length || 5;
    const uniqueCode = await this.generateUniqueExternalId(codeLength, triggerEntity, computedFieldMetadata.fieldName);
    triggerEntity[computedFieldMetadata.fieldName] = `${prefix}-${uniqueCode}`;
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
    const count = await this.entityManager.count(triggerEntity.constructor.name, {
      where: { [fieldName]: externalId },
    });
    return count === 0;
  }

  private async generateUniqueExternalId(codeLength: number, triggerEntity: T, fieldName: string): Promise<string> {
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const newId = this.generateRandomCode(codeLength);

      const isUnique = await this.isExternalIdUnique(newId, triggerEntity, fieldName);

      if (isUnique) {
        return newId;
      }
    }

    throw new Error('Failed to generate a unique external ID after multiple attempts');
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { FieldMetadata } from 'src/entities/field-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { MigrationScope } from './media-migration-scope';

const MEDIA_FIELD_TYPES = ['mediaSingle', 'mediaMultiple'];

export interface FieldMoveResult {
  /** Fields now pointing at the new provider. */
  movedFieldIds: number[];
  /** Metadata JSON files rewritten, to be committed to the app repository. */
  updatedMetadataFiles: string[];
  /** Problems to show the admin. A field can be moved in the database and still need a manual JSON edit. */
  warnings: string[];
}

/**
 * Points media fields at a different provider, and keeps the module metadata JSON in step.
 *
 * The JSON matters: the seeder reads it on every run, so a field changed only in the database would
 * be switched back by the next seed. The JSON is rewritten from the database by the same code the
 * model builder uses, so the two stay identical.
 */
@Injectable()
export class MediaMigrationFieldsService {
  private readonly logger = new Logger(MediaMigrationFieldsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly modelMetadataService: ModelMetadataService,
    private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
  ) { }

  /**
   * Media fields that point at `fromProviderId` and fall inside the scope. A field-level or model-level
   * scope limits the fields; a whole-provider scope takes every media field on the provider.
   */
  async findFieldsToMove(scope: MigrationScope): Promise<number[]> {
    const qb = this.dataSource.getRepository(FieldMetadata).createQueryBuilder('field')
      .innerJoin('field.mediaStorageProvider', 'provider')
      .innerJoin('field.model', 'model')
      .select('field.id', 'id')
      .where('provider.id = :providerId', { providerId: scope.sourceProviderId })
      .andWhere('field.type IN (:...types)', { types: MEDIA_FIELD_TYPES });

    if (scope.fieldMetadataIds?.length) {
      qb.andWhere('field.id IN (:...fieldIds)', { fieldIds: scope.fieldMetadataIds });
    } else if (scope.modelMetadataIds?.length) {
      qb.andWhere('model.id IN (:...modelIds)', { modelIds: scope.modelMetadataIds });
    }
    const rows: { id: number }[] = await qb.getRawMany();
    return rows.map(row => Number(row.id));
  }

  /**
   * Points the given fields at `toProvider`, but only those that currently point at `fromProviderId`,
   * then rewrites the metadata JSON of each model that changed.
   *
   * The database change is kept even if a JSON file cannot be written. The admin is told which field
   * to fix by hand, so nothing is lost; the change is never silently half-applied.
   */
  async moveFields(fieldIds: number[], fromProviderId: number, toProvider: { id: number; name: string }): Promise<FieldMoveResult> {
    if (fieldIds.length === 0) {
      return { movedFieldIds: [], updatedMetadataFiles: [], warnings: [] };
    }

    const fields = await this.dataSource.getRepository(FieldMetadata).find({
      where: { id: In(fieldIds), mediaStorageProvider: { id: fromProviderId } },
      relations: ['model', 'model.module'],
    });
    if (fields.length === 0) {
      return { movedFieldIds: [], updatedMetadataFiles: [], warnings: [] };
    }

    await this.dataSource.getRepository(FieldMetadata).createQueryBuilder()
      .update(FieldMetadata)
      .set({ mediaStorageProvider: { id: toProvider.id } as any })
      .where('id IN (:...ids)', { ids: fields.map(field => field.id) })
      .execute();

    const warnings: string[] = [];
    const files = new Set<string>();
    const byModel = new Map<number, FieldMetadata[]>();
    for (const field of fields) {
      byModel.set(field.model.id, [...(byModel.get(field.model.id) ?? []), field]);
    }

    for (const [modelId, modelFields] of byModel) {
      const model = modelFields[0].model;
      try {
        await this.modelMetadataService.updateInFile(modelId, this.dataSource.getRepository(ModelMetadata));
        files.add(await this.moduleMetadataHelperService.getModuleMetadataFilePath(model.module?.name));
      } catch (error: any) {
        const names = modelFields.map(field => `"${field.name}"`).join(', ');
        const message = `Fields ${names} of model "${model.singularName}" now use "${toProvider.name}" in the database, but their metadata JSON could not be updated (${error?.message ?? error}). ` +
          `Set mediaStorageProviderUserKey to "${toProvider.name}" for them in the ${model.module?.name ?? 'module'} metadata file by hand, otherwise the next seed switches them back.`;
        warnings.push(message);
        this.logger.warn(message);
      }
    }

    return {
      movedFieldIds: fields.map(field => field.id),
      updatedMetadataFiles: [...files],
      warnings,
    };
  }
}

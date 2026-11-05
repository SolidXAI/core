import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Starts a media migration from one storage provider to another. Providers can be given by id or by
 * name. Scope lists are optional: none means the whole source provider.
 */
export class CreateMediaMigrationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sourceProviderId?: number;

  @IsOptional()
  @IsString()
  sourceProviderName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetProviderId?: number;

  @IsOptional()
  @IsString()
  targetProviderName?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  modelMetadataIds?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  fieldMetadataIds?: number[];

  // Replace a same-named file at the target that has different content. Defaults to false.
  // Form posts send "false" as text, which implicit conversion would turn into true, so read the raw value.
  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === '') return undefined;
    return raw;
  })
  @IsBoolean()
  overwriteExisting?: boolean;

  // Clamped by the engine: batchSize to 10-1000, concurrency to 1-16.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  batchSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  concurrency?: number;
}

export class CleanupMediaMigrationSourceDto {
  // Must be exactly DELETE_SOURCE_FILES. Deleting source files cannot be undone.
  @IsString()
  confirm: string;
}

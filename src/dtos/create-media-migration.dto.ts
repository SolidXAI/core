import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

/** A field, named by its userKey (its name) and the userKey of the model it belongs to. */
export class FieldUserKeyDto {
  @IsString()
  @IsNotEmpty()
  modelUserKey: string;

  @IsString()
  @IsNotEmpty()
  fieldUserKey: string;
}

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

  // Same scope by user key. A model's userKey is its singularName, so "product".
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  modelUserKeys?: string[];

  // A field's userKey is its name, which can repeat across models, so each field also names its model.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldUserKeyDto)
  fieldUserKeys?: FieldUserKeyDto[];

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

export class CleanupMediaMigrationDto {
  // DELETE_SOURCE_FILES for a finished migration, DELETE_TARGET_FILES for a rolled-back one.
  // Deleting files cannot be undone.
  @IsString()
  confirm: string;
}

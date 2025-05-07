import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  ValidateIf
} from 'class-validator';
export enum RelationFieldsCommand {
  set = "set",
  clear = "clear",
  link = "link",
  unlink = "unlink",
  create = "create",
  update = "update",
  delete = "delete"
}

export enum SolidFieldType {
  // numeric types
  int = 'int',
  bigint = 'bigint',
  // float = 'float',
  // double = 'double',
  decimal = 'decimal',

  // text types
  shortText = 'shortText',
  longtext = 'longText',
  richText = 'richText',
  json = 'json',

  // boolean types
  boolean = 'boolean',

  // date
  date = 'date',
  datetime = 'datetime',
  time = 'time',

  // relation
  relation = 'relation',

  // media
  mediaSingle = 'mediaSingle',
  mediaMultiple = 'mediaMultiple',

  email = 'email',
  password = 'password',

  // selection
  selectionStatic = 'selectionStatic',
  selectionDynamic = 'selectionDynamic',

  computed = 'computed',

  uuid = 'uuid'
}

export enum OrmType {
  MySQLType,
}

export enum MySQLType { //FIXME Currently this type is being used in the definition, Need to use OrmType instead
  // Numeric types
  int = 'int',
  decimal = 'decimal',
  double = 'double',

  // Text types
  // fieldType=shortText
  varchar = 'varchar',
  // fieldType=longText
  text = 'shortText',
  mediumtext = 'mediumtext',
  longtext = 'longtext',

  // Boolean types
  // fieldType=boolean
  bool = 'bool',
  boolean = 'boolean',

  //Date Types
  date = 'date',
  datetime = 'datetime',
  timestamp = 'timestamp',
  time = 'time',

  // Other types
  json = 'json',

}

export enum PSQLType { //FIXME Currently this type is being used in the definition, Need to use OrmType instead
  // Numeric types
  integer = 'integer',
  decimal = 'decimal',
  bigint = 'bigint',

  // Text types
  varchar = 'varchar',
  text = 'text',

  // Boolean types
  boolean = 'boolean',

  // Date types
  timestamp = 'timestamp',
  timestamptz = 'timestamptz',
  time = 'time',
  date = 'date',

  // Other types
  json = 'json',
  jsonb = 'jsonb',
}


export enum EncryptionType {
  aes128 = 'aes-128',
  aes256 = 'aes-256',
}

export enum DecryptWhenType {
  beforeTransit = 'before-transit',
  afterTransit = 'after-transit',
}

export enum MediaType {
  image = 'image',
  audio = 'audio',
  video = 'video',
  // document = 'document',
  file = 'file',
}

export enum RelationType {
  manyToOne = 'many-to-one',
  manyTomany = 'many-to-many',
  oneToMany = 'one-to-many',
}

export enum CascadeType {
  setNull = 'set null',
  restrict = 'restrict',
  cascade = 'cascade',
}

// export enum MediaStorageProviderType {
//   database = 'database',
//   file = 'file',
//   s3 = 's3',
// }

export enum SelectionValueType {
  string = 'string',
  int = 'int',
}

export enum ComputedFieldValueType {
  string = 'string',
  int = 'int',
  decimal = 'decimal',
  boolean = 'boolean',
  date = 'date',
  datetime = 'datetime',
}

export class CreateFieldMetadataDto {
  @ApiProperty({ description: 'Name of your field, this is also the name of the column or attribute', })
  // @Matches(/[a-z]+(_[a-z]+)*/, { message: 'Field name should follow snake case conventions only with all lower case.', })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Display name of your field' })
  @IsString()
  readonly displayName: string;


  @ApiProperty({ description: 'Description of your field' })
  @IsOptional()
  @IsString()
  readonly description: string;

  // @ApiProperty({ description: "Help text associated with this field" })
  // @IsString()
  // readonly helpText: string;

  @ApiProperty({ description: 'Field can have types' })
  @IsEnum(SolidFieldType)
  readonly type: SolidFieldType;

  @ApiProperty({ description: 'Related model id' })
  @IsInt()
  @IsOptional()
  readonly modelId: number;

  //For all types of fields
  @ApiProperty({ description: 'Field can have orm types specific to your database', })
  @IsEnum(PSQLType)
  @IsOptional()
  readonly ormType: PSQLType;

  @ApiProperty({ description: 'Length of the field. Only for type=text' })
  @IsInt()
  @IsOptional()
  readonly length: number;

  @ApiProperty({ description: 'Default value of the field' })
  @IsString()
  @IsOptional()
  readonly defaultValue: string;

  @ApiProperty({ description: 'Format regex pattern for the field. Only for type=text, longText, email, password', })
  @IsString()
  @IsOptional()
  readonly regexPattern: string;

  @ApiProperty({ description: 'If the regex pattern matching fails, then what is the error message to be displayed', })
  @IsString()
  @IsOptional()
  readonly regexPatternNotMatchingErrorMsg: string;

  @ApiProperty({ description: 'Is the field mandatory?' })
  @IsBoolean()
  readonly required: boolean;

  @ApiProperty({ description: 'Is the field value unique?' })
  @IsBoolean()
  @IsOptional()
  readonly unique: boolean;

  @ApiProperty({ description: 'Is the field symmetric encrypted?' })
  @IsBoolean()
  readonly encrypt: boolean;

  @ApiProperty({ description: 'Type of encryption. Only if encrypt=true' })
  @IsEnum(EncryptionType)
  @IsOptional()
  readonly encryptionType: EncryptionType;

  //Pending
  @ApiProperty({ description: 'At what point do we want to decrypt the data? Only if encrypt=true', })
  @IsEnum(DecryptWhenType)
  @IsOptional()
  decryptWhen: DecryptWhenType;

  @ApiProperty({ description: 'Is the field indexed? For all types, except:richText, longText', })
  @IsBoolean()
  index: boolean;

  @ApiProperty({ description: 'for text fields, this is length. for numeric fields, this is the range of values allowed. Only for type=shortText,longText,richText,json,int,decimal,date,dateTime,time', })
  @IsInt()
  @IsOptional()
  max: number;

  @ApiProperty({ description: 'for text fields, this is length. for numeric fields, this is the range of values allowed. Only for type=shortText,longText,richText,json,int,decimal,date,dateTime,time', })
  @IsInt()
  @IsOptional()
  min: number;

  @ApiProperty({ description: 'Is the field private?' })
  @IsBoolean()
  private: boolean;

  @ApiProperty({ description: 'Allowed media types for the field. Only for type=mediaSingle,mediaMultiple', })
  @IsEnum(MediaType, { each: true })
  @IsOptional()
  mediaTypes: MediaType[];

  @ApiProperty({ description: 'Maximum size of the media in KB. Only for type=mediaSingle,mediaMultiple', })
  @IsInt()
  @IsOptional()
  mediaMaxSizeKb: number;

  @ApiProperty({ description: 'Configured Media storage provider. Only for type=mediaSingle,mediaMultiple', })
  @IsInt()
  @IsOptional()
  mediaStorageProviderId?: number;

  @ApiProperty({ description: 'Configured Media storage provider. Only for type=mediaSingle,mediaMultiple. When you need to specify the storage provider by name.', })
  @IsInt()
  @IsOptional()
  mediaStorageProviderUserKey?: string;

  // @ApiProperty({ description: 'Is the media embedded in the entity table? Only for type=mediaSingle', })
  // @IsBoolean()
  // @IsOptional()
  // mediaEmbedded: boolean;

  @ApiProperty({ description: 'Relation Type. Only for type=relation' })
  @IsEnum(RelationType)
  @IsOptional()
  relationType: RelationType;

  @ApiProperty({ description: 'Related model for the relation. Only for type=relation' })
  @IsString()
  @IsOptional()
  relationCoModelSingularName: string;

  @ApiProperty({ description: 'Create inverse relation. Only for type=relation', })
  @IsBoolean()
  @IsOptional()
  relationCreateInverse: boolean;

  @ApiProperty({ description: 'Cascade type. Only for type=relation' })
  @IsEnum(CascadeType)
  @IsOptional()
  relationCascade: CascadeType;

  @ApiProperty({ description: 'Related field module. Only required for type=relation, if the related field belongs to a different module' })
  @IsOptional()
  relationModelModuleName: string;

  @ApiProperty({ description: 'Related field module. Only required for type=relation and relationType=many-to-many, i.e if the related many to many field belongs to a different model' })
  @IsOptional()
  relationCoModelFieldName: string;

  @ApiProperty({ description: 'Only for type=relation, many-to-many. This field is used to set the owner of the many-to-many relation' })
  @IsOptional()
  isRelationManyToManyOwner: boolean;


  @ApiProperty({ description: 'Only for type=relation, many-to-many. This field is used to store fixed filters that needs to applied on related model' })
  @IsOptional()
  relationFieldFixedFilter: string;

  @ApiProperty({
    description:
      'Dynamic provider for selection. Only for type=selectionDynamic',
  })
  @IsString()
  @IsOptional()
  selectionDynamicProvider: string;

  @ApiProperty({ description: 'Dynamic provider Context. Only for type=selectionDynamic', })
  @IsString()
  @IsOptional()
  selectionDynamicProviderCtxt: string;

  @ApiProperty({ description: 'Static values for selection. Only for type=selectionStatic', })
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[\w\s\d-]+:[\w\s-]+$/, { each: true })
  @IsOptional()
  selectionStaticValues: string[];

  @ApiProperty({ description: 'Type of value for selection. Applicable for type=selectionStatic,selectionDynamic', })
  @IsEnum(SelectionValueType)
  @IsOptional()
  selectionValueType: SelectionValueType;

  @ApiProperty({ description: 'Computed Field Value Provider. Only for type=computed', })
  @IsString()
  @IsOptional()
  computedFieldValueProvider: string;

  @ApiProperty({ description: 'Computed Field Value Provider Context. Only for type=computed', })
  @IsString()
  @IsOptional()
  computedFieldValueProviderCtxt: string;

  @ApiProperty({ description: 'Computed field value type. Only for type=computed', })
  @IsEnum(ComputedFieldValueType)
  @IsOptional()
  computedFieldValueType: ComputedFieldValueType;

  @IsOptional()
  @ApiProperty({ description: 'Uuid.', })
  @IsString()
  @IsOptional()
  uuid: string;

  @IsOptional()
  @ApiProperty({ description: 'System fields are not included in the code generation, the assumption being that system fields have manually written code.', })
  @IsBoolean()
  isSystem: boolean;

  @IsOptional()
  @ApiProperty({ description: 'Marked for removal, this is used to soft delete the field.', })
  @IsBoolean()
  isMarkedForRemoval: boolean;

  @ApiProperty({ description: 'Column Name of Field', })
  @IsString()
  @IsOptional()
  columnName: string

  @ApiProperty({ description: 'Relation CoModel Column Name of Field', })
  @IsString()
  @IsOptional()
  relationCoModelColumnName: string

  @ApiProperty({ description: "Is User Key" })
  @IsOptional()
  @IsBoolean()
  readonly isUserKey: boolean

  @ApiProperty({ description: 'Relation Join Table Name of Field', })
  @IsString()
  @IsOptional()
  relationJoinTableName: string

  @IsOptional()
  @IsBoolean()
  enableAuditTracking?: boolean;

  @IsOptional()
  @ApiProperty({ description: 'Is MultiSelect Field', })
  @IsBoolean()
  isMultiSelect: boolean;
}
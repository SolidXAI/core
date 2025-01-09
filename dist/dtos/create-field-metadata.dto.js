"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFieldMetadataDto = exports.ComputedFieldValueType = exports.SelectionValueType = exports.CascadeType = exports.RelationType = exports.MediaType = exports.DecryptWhenType = exports.EncryptionType = exports.PSQLType = exports.MySQLType = exports.OrmType = exports.SolidFieldType = exports.RelationFieldsCommand = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var RelationFieldsCommand;
(function (RelationFieldsCommand) {
    RelationFieldsCommand["set"] = "set";
    RelationFieldsCommand["clear"] = "clear";
    RelationFieldsCommand["link"] = "link";
    RelationFieldsCommand["unlink"] = "unlink";
    RelationFieldsCommand["create"] = "create";
    RelationFieldsCommand["update"] = "update";
    RelationFieldsCommand["delete"] = "delete";
})(RelationFieldsCommand || (exports.RelationFieldsCommand = RelationFieldsCommand = {}));
var SolidFieldType;
(function (SolidFieldType) {
    SolidFieldType["int"] = "int";
    SolidFieldType["bigint"] = "bigint";
    SolidFieldType["decimal"] = "decimal";
    SolidFieldType["shortText"] = "shortText";
    SolidFieldType["longtext"] = "longText";
    SolidFieldType["richText"] = "richText";
    SolidFieldType["json"] = "json";
    SolidFieldType["boolean"] = "boolean";
    SolidFieldType["date"] = "date";
    SolidFieldType["datetime"] = "datetime";
    SolidFieldType["time"] = "time";
    SolidFieldType["relation"] = "relation";
    SolidFieldType["mediaSingle"] = "mediaSingle";
    SolidFieldType["mediaMultiple"] = "mediaMultiple";
    SolidFieldType["email"] = "email";
    SolidFieldType["password"] = "password";
    SolidFieldType["selectionStatic"] = "selectionStatic";
    SolidFieldType["selectionDynamic"] = "selectionDynamic";
    SolidFieldType["computed"] = "computed";
    SolidFieldType["uuid"] = "uuid";
})(SolidFieldType || (exports.SolidFieldType = SolidFieldType = {}));
var OrmType;
(function (OrmType) {
    OrmType[OrmType["MySQLType"] = 0] = "MySQLType";
})(OrmType || (exports.OrmType = OrmType = {}));
var MySQLType;
(function (MySQLType) {
    MySQLType["int"] = "int";
    MySQLType["decimal"] = "decimal";
    MySQLType["double"] = "double";
    MySQLType["varchar"] = "varchar";
    MySQLType["text"] = "shortText";
    MySQLType["mediumtext"] = "mediumtext";
    MySQLType["longtext"] = "longtext";
    MySQLType["bool"] = "bool";
    MySQLType["boolean"] = "boolean";
    MySQLType["date"] = "date";
    MySQLType["datetime"] = "datetime";
    MySQLType["timestamp"] = "timestamp";
    MySQLType["time"] = "time";
    MySQLType["json"] = "json";
})(MySQLType || (exports.MySQLType = MySQLType = {}));
var PSQLType;
(function (PSQLType) {
    PSQLType["integer"] = "integer";
    PSQLType["decimal"] = "decimal";
    PSQLType["bigint"] = "bigint";
    PSQLType["varchar"] = "varchar";
    PSQLType["text"] = "text";
    PSQLType["boolean"] = "boolean";
    PSQLType["timestamp"] = "timestamp";
    PSQLType["timestamptz"] = "timestamptz";
    PSQLType["time"] = "time";
    PSQLType["date"] = "date";
    PSQLType["json"] = "json";
    PSQLType["jsonb"] = "jsonb";
})(PSQLType || (exports.PSQLType = PSQLType = {}));
var EncryptionType;
(function (EncryptionType) {
    EncryptionType["aes128"] = "aes-128";
    EncryptionType["aes256"] = "aes-256";
})(EncryptionType || (exports.EncryptionType = EncryptionType = {}));
var DecryptWhenType;
(function (DecryptWhenType) {
    DecryptWhenType["beforeTransit"] = "before-transit";
    DecryptWhenType["afterTransit"] = "after-transit";
})(DecryptWhenType || (exports.DecryptWhenType = DecryptWhenType = {}));
var MediaType;
(function (MediaType) {
    MediaType["image"] = "image";
    MediaType["audio"] = "audio";
    MediaType["video"] = "video";
    MediaType["file"] = "file";
})(MediaType || (exports.MediaType = MediaType = {}));
var RelationType;
(function (RelationType) {
    RelationType["manyToOne"] = "many-to-one";
    RelationType["manyTomany"] = "many-to-many";
})(RelationType || (exports.RelationType = RelationType = {}));
var CascadeType;
(function (CascadeType) {
    CascadeType["setNull"] = "set null";
    CascadeType["restrict"] = "restrict";
    CascadeType["cascade"] = "cascade";
})(CascadeType || (exports.CascadeType = CascadeType = {}));
var SelectionValueType;
(function (SelectionValueType) {
    SelectionValueType["string"] = "string";
    SelectionValueType["int"] = "int";
})(SelectionValueType || (exports.SelectionValueType = SelectionValueType = {}));
var ComputedFieldValueType;
(function (ComputedFieldValueType) {
    ComputedFieldValueType["string"] = "string";
    ComputedFieldValueType["int"] = "int";
    ComputedFieldValueType["decimal"] = "decimal";
    ComputedFieldValueType["boolean"] = "boolean";
    ComputedFieldValueType["date"] = "date";
    ComputedFieldValueType["datetime"] = "datetime";
})(ComputedFieldValueType || (exports.ComputedFieldValueType = ComputedFieldValueType = {}));
class CreateFieldMetadataDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, displayName: { required: true, type: () => String }, description: { required: true, type: () => String }, type: { required: true, enum: require("./create-field-metadata.dto").SolidFieldType }, modelId: { required: true, type: () => Number }, ormType: { required: true, enum: require("./create-field-metadata.dto").PSQLType }, length: { required: true, type: () => Number }, defaultValue: { required: true, type: () => String }, regexPattern: { required: true, type: () => String }, regexPatternNotMatchingErrorMsg: { required: true, type: () => String }, required: { required: true, type: () => Boolean }, unique: { required: true, type: () => Boolean }, encrypt: { required: true, type: () => Boolean }, encryptionType: { required: true, enum: require("./create-field-metadata.dto").EncryptionType }, decryptWhen: { required: true, enum: require("./create-field-metadata.dto").DecryptWhenType }, index: { required: true, type: () => Boolean }, max: { required: true, type: () => Number }, min: { required: true, type: () => Number }, private: { required: true, type: () => Boolean }, mediaTypes: { required: true, enum: require("./create-field-metadata.dto").MediaType, isArray: true }, mediaMaxSizeKb: { required: true, type: () => Number }, mediaStorageProviderId: { required: false, type: () => Number }, mediaStorageProviderUserKey: { required: false, type: () => String }, relationType: { required: true, enum: require("./create-field-metadata.dto").RelationType }, relationModelSingularName: { required: true, type: () => String }, relationCreateInverse: { required: true, type: () => Boolean }, relationCascade: { required: true, enum: require("./create-field-metadata.dto").CascadeType }, relationModelModuleName: { required: true, type: () => String }, relationModelFieldName: { required: true, type: () => String }, selectionDynamicProvider: { required: true, type: () => String }, selectionDynamicProviderCtxt: { required: true, type: () => String }, selectionStaticValues: { required: true, type: () => [String], pattern: "/^[\\w\\s\\d-]+:[\\w\\s-]+$/" }, selectionValueType: { required: true, enum: require("./create-field-metadata.dto").SelectionValueType }, computedFieldValueProvider: { required: true, type: () => String }, computedFieldValueProviderCtxt: { required: true, type: () => String }, computedFieldValueType: { required: true, enum: require("./create-field-metadata.dto").ComputedFieldValueType }, uuid: { required: true, type: () => String }, isSystem: { required: true, type: () => Boolean }, isMarkedForRemoval: { required: true, type: () => Boolean }, columnName: { required: true, type: () => String } };
    }
}
exports.CreateFieldMetadataDto = CreateFieldMetadataDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Name of your field, this is also the name of the column or attribute', }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Display name of your field' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "displayName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Description of your field' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Field can have types' }),
    (0, class_validator_1.IsEnum)(SolidFieldType),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Related model id' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateFieldMetadataDto.prototype, "modelId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Field can have orm types specific to your database', }),
    (0, class_validator_1.IsEnum)(PSQLType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "ormType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Length of the field. Only for type=text' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateFieldMetadataDto.prototype, "length", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Default value of the field' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "defaultValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Format regex pattern for the field. Only for type=text, longText, email, password', }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "regexPattern", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'If the regex pattern matching fails, then what is the error message to be displayed', }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "regexPatternNotMatchingErrorMsg", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Is the field mandatory?' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "required", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Is the field value unique?' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "unique", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Is the field symmetric encrypted?' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "encrypt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Type of encryption. Only if encrypt=true' }),
    (0, class_validator_1.IsEnum)(EncryptionType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "encryptionType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'At what point do we want to decrypt the data? Only if encrypt=true', }),
    (0, class_validator_1.IsEnum)(DecryptWhenType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "decryptWhen", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Is the field indexed? For all types, except:richText, longText', }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "index", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'for text fields, this is length. for numeric fields, this is the range of values allowed. Only for type=shortText,longText,richText,json,int,decimal,date,dateTime,time', }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ obj }) => obj.length ?? undefined),
    (0, class_validator_1.ValidateIf)((obj) => obj.length !== undefined),
    __metadata("design:type", Number)
], CreateFieldMetadataDto.prototype, "max", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'for text fields, this is length. for numeric fields, this is the range of values allowed. Only for type=shortText,longText,richText,json,int,decimal,date,dateTime,time', }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateFieldMetadataDto.prototype, "min", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Is the field private?' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "private", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Allowed media types for the field. Only for type=mediaSingle,mediaMultiple', }),
    (0, class_validator_1.IsEnum)(MediaType, { each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateFieldMetadataDto.prototype, "mediaTypes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Maximum size of the media in KB. Only for type=mediaSingle,mediaMultiple', }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateFieldMetadataDto.prototype, "mediaMaxSizeKb", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Configured Media storage provider. Only for type=mediaSingle,mediaMultiple', }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateFieldMetadataDto.prototype, "mediaStorageProviderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Configured Media storage provider. Only for type=mediaSingle,mediaMultiple. When you need to specify the storage provider by name.', }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "mediaStorageProviderUserKey", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Relation Type. Only for type=relation' }),
    (0, class_validator_1.IsEnum)(RelationType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "relationType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Related model for the relation. Only for type=relation' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "relationModelSingularName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Create inverse relation. Only for type=relation', }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "relationCreateInverse", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cascade type. Only for type=relation' }),
    (0, class_validator_1.IsEnum)(CascadeType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "relationCascade", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Related field module. Only required for type=relation, if the related field belongs to a different module' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "relationModelModuleName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Related field module. Only required for type=relation and relationType=many-to-many, i.e if the related many to many field belongs to a different model' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "relationModelFieldName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Dynamic provider for selection. Only for type=selectionDynamic',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "selectionDynamicProvider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Dynamic provider Context. Only for type=selectionDynamic', }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "selectionDynamicProviderCtxt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Static values for selection. Only for type=selectionStatic', }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Matches)(/^[\w\s\d-]+:[\w\s-]+$/, { each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateFieldMetadataDto.prototype, "selectionStaticValues", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Type of value for selection. Applicable for type=selectionStatic,selectionDynamic', }),
    (0, class_validator_1.IsEnum)(SelectionValueType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "selectionValueType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Computed Field Value Provider. Only for type=computed', }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "computedFieldValueProvider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Computed Field Value Provider Context. Only for type=computed', }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "computedFieldValueProviderCtxt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Computed field value type. Only for type=computed', }),
    (0, class_validator_1.IsEnum)(ComputedFieldValueType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "computedFieldValueType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: 'Uuid.', }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "uuid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: 'System fields are not included in the code generation, the assumption being that system fields have manually written code.', }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "isSystem", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiProperty)({ description: 'Marked for removal, this is used to soft delete the field.', }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFieldMetadataDto.prototype, "isMarkedForRemoval", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Column Name of Field', }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateFieldMetadataDto.prototype, "columnName", void 0);
//# sourceMappingURL=create-field-metadata.dto.js.map
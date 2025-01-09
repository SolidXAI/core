export declare enum RelationFieldsCommand {
    set = "set",
    clear = "clear",
    link = "link",
    unlink = "unlink",
    create = "create",
    update = "update",
    delete = "delete"
}
export declare enum SolidFieldType {
    int = "int",
    bigint = "bigint",
    decimal = "decimal",
    shortText = "shortText",
    longtext = "longText",
    richText = "richText",
    json = "json",
    boolean = "boolean",
    date = "date",
    datetime = "datetime",
    time = "time",
    relation = "relation",
    mediaSingle = "mediaSingle",
    mediaMultiple = "mediaMultiple",
    email = "email",
    password = "password",
    selectionStatic = "selectionStatic",
    selectionDynamic = "selectionDynamic",
    computed = "computed",
    uuid = "uuid"
}
export declare enum OrmType {
    MySQLType = 0
}
export declare enum MySQLType {
    int = "int",
    decimal = "decimal",
    double = "double",
    varchar = "varchar",
    text = "shortText",
    mediumtext = "mediumtext",
    longtext = "longtext",
    bool = "bool",
    boolean = "boolean",
    date = "date",
    datetime = "datetime",
    timestamp = "timestamp",
    time = "time",
    json = "json"
}
export declare enum PSQLType {
    integer = "integer",
    decimal = "decimal",
    bigint = "bigint",
    varchar = "varchar",
    text = "text",
    boolean = "boolean",
    timestamp = "timestamp",
    timestamptz = "timestamptz",
    time = "time",
    date = "date",
    json = "json",
    jsonb = "jsonb"
}
export declare enum EncryptionType {
    aes128 = "aes-128",
    aes256 = "aes-256"
}
export declare enum DecryptWhenType {
    beforeTransit = "before-transit",
    afterTransit = "after-transit"
}
export declare enum MediaType {
    image = "image",
    audio = "audio",
    video = "video",
    file = "file"
}
export declare enum RelationType {
    manyToOne = "many-to-one",
    manyTomany = "many-to-many"
}
export declare enum CascadeType {
    setNull = "set null",
    restrict = "restrict",
    cascade = "cascade"
}
export declare enum SelectionValueType {
    string = "string",
    int = "int"
}
export declare enum ComputedFieldValueType {
    string = "string",
    int = "int",
    decimal = "decimal",
    boolean = "boolean",
    date = "date",
    datetime = "datetime"
}
export declare class CreateFieldMetadataDto {
    name: string;
    readonly displayName: string;
    readonly description: string;
    readonly type: SolidFieldType;
    readonly modelId: number;
    readonly ormType: PSQLType;
    readonly length: number;
    readonly defaultValue: string;
    readonly regexPattern: string;
    readonly regexPatternNotMatchingErrorMsg: string;
    readonly required: boolean;
    readonly unique: boolean;
    readonly encrypt: boolean;
    readonly encryptionType: EncryptionType;
    decryptWhen: DecryptWhenType;
    index: boolean;
    max: number;
    min: number;
    private: boolean;
    mediaTypes: MediaType[];
    mediaMaxSizeKb: number;
    mediaStorageProviderId?: number;
    mediaStorageProviderUserKey?: string;
    relationType: RelationType;
    relationModelSingularName: string;
    relationCreateInverse: boolean;
    relationCascade: CascadeType;
    relationModelModuleName: string;
    relationModelFieldName: string;
    selectionDynamicProvider: string;
    selectionDynamicProviderCtxt: string;
    selectionStaticValues: string[];
    selectionValueType: SelectionValueType;
    computedFieldValueProvider: string;
    computedFieldValueProviderCtxt: string;
    computedFieldValueType: ComputedFieldValueType;
    uuid: string;
    isSystem: boolean;
    isMarkedForRemoval: boolean;
    columnName: string;
}

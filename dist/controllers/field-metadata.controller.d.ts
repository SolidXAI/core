import { CreateFieldMetadataDto } from '../dtos/create-field-metadata.dto';
import { FieldMetadataService } from '../services/field-metadata.service';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { SelectionDynamicQueryDto } from '../dtos/selection-dynamic-query.dto';
export declare class FieldMetadataController {
    private readonly fieldMetadataService;
    constructor(fieldMetadataService: FieldMetadataService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").FieldMetadata[];
    }>;
    findFieldDefaultMetaData(): Promise<{
        fieldTypes: {
            type: string;
            label: string;
            value: string;
            fieldType: string;
            ormTypes: {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[] | {
                label: import("../dtos/create-field-metadata.dto").PSQLType;
                description: string;
            }[];
            fields: string[];
        }[];
        encryptionTypes: {
            label: unknown;
            value: unknown;
        }[];
        ormType: {
            postgres: {
                int: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                bigint: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                decimal: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                shortText: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                longText: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                richText: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                json: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                boolean: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                date: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                datetime: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                time: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                relation: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                mediaSingle: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                mediaMultiple: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                email: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                password: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                selectionStatic: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                selectionDynamic: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                computed: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
                uuid: {
                    ormTypes: {
                        label: import("../dtos/create-field-metadata.dto").PSQLType;
                        description: string;
                    }[];
                };
            };
        };
        decryptWhenTypes: {
            label: unknown;
            value: unknown;
        }[];
        mediaTypes: {
            label: unknown;
            value: unknown;
        }[];
        relationTypes: {
            label: unknown;
            value: unknown;
        }[];
        selectionDynamicProviders: any[];
        computedProviders: any[];
        cascadeTypes: {
            label: unknown;
            value: unknown;
        }[];
        selectionValueTypes: {
            label: unknown;
            value: unknown;
        }[];
        computedFieldValueTypes: {
            label: unknown;
            value: unknown;
        }[];
        dataSourceType: string[];
        dataSource: {
            name: any;
            type: any;
        }[];
    }>;
    getSelectionDynamicValues(query: SelectionDynamicQueryDto): Promise<readonly import("..").ISelectionProviderValues[]>;
    getSelectionDynamicValue(query: SelectionDynamicQueryDto): Promise<any>;
    findOne(id: number, query: any): Promise<import("..").FieldMetadata>;
    create(createDtos: CreateFieldMetadataDto[]): Promise<import("..").FieldMetadata[]>;
    remove(id: number): Promise<import("..").FieldMetadata>;
}

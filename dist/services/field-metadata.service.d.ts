import { FieldMetadata } from '../entities/field-metadata.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateFieldMetadataDto, PSQLType } from '../dtos/create-field-metadata.dto';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { BasicFilterDto } from '../dtos/basic-filters.dto';
import { CrudHelperService } from './crud-helper.service';
import { UpdateFieldMetaDataDto } from '../dtos/update-field-metadata.dto';
import { SelectionDynamicQueryDto } from '../dtos/selection-dynamic-query.dto';
import { ISelectionProviderValues } from '../interfaces';
export declare class FieldMetadataService {
    private readonly fieldMetadataRepo;
    private readonly dataSource;
    private readonly solidRegistry;
    private readonly crudHelperService;
    constructor(fieldMetadataRepo: Repository<FieldMetadata>, dataSource: DataSource, solidRegistry: SolidRegistry, crudHelperService: CrudHelperService);
    findMany(basicFilterDto: BasicFilterDto): Promise<{
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: FieldMetadata[];
    }>;
    findOne(id: any, query?: any): Promise<FieldMetadata>;
    findByNameAndModelName(modelSingularName: string, fieldName: string): Promise<FieldMetadata>;
    selectionStaticValues(modelSingularName: string, fieldName: string): Promise<ISelectionProviderValues[]>;
    convertToSelectionProviderValues(selectionStaticValues: string[]): ISelectionProviderValues[];
    create(createDto: CreateFieldMetadataDto): Promise<FieldMetadata>;
    remove(id: number): Promise<FieldMetadata>;
    findFieldDefaultMetaData(): Promise<{
        fieldTypes: {
            type: string;
            label: string;
            value: string;
            fieldType: string;
            ormTypes: {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
                description: string;
            }[] | {
                label: PSQLType;
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
                        label: PSQLType;
                        description: string;
                    }[];
                };
                bigint: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                decimal: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                shortText: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                longText: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                richText: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                json: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                boolean: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                date: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                datetime: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                time: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                relation: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                mediaSingle: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                mediaMultiple: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                email: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                password: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                selectionStatic: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                selectionDynamic: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                computed: {
                    ormTypes: {
                        label: PSQLType;
                        description: string;
                    }[];
                };
                uuid: {
                    ormTypes: {
                        label: PSQLType;
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
    fetchCurrentFieldsBasedOnType(type: string): Promise<string[]>;
    private fetchCurrentFields;
    fetchAllDataSources(): Promise<void>;
    upsert(updateDto: UpdateFieldMetaDataDto): Promise<FieldMetadata>;
    getSelectionDynamicValues(query: SelectionDynamicQueryDto): Promise<readonly ISelectionProviderValues[]>;
    getSelectionDynamicValue(query: SelectionDynamicQueryDto): Promise<any>;
}

import { ColumnOptions } from "typeorm";
import { DatasourceType } from "src/dtos/create-model-metadata.dto";

const LONG_TEXT_MAP: Record<DatasourceType, ColumnOptions> = {
    [DatasourceType.postgres]: { type: "text" },
    [DatasourceType.mssql]: { type: "nvarchar", length: "max" },
    [DatasourceType.mysql]: { type: "longtext" },
    [DatasourceType.mariadb]: { type: "longtext" },
    [DatasourceType.oracle]: { type: "clob" },
};

// For simple-json columns that may contain large payloads: on MySQL/MariaDB the default
// TEXT backing store is limited to 64 KB, so we override the type to longtext and supply
// an explicit JSON transformer so TypeORM still serialises/deserialises correctly.
const SIMPLE_JSON_LARGE_TEXT_MAP: Record<DatasourceType, ColumnOptions> = {
    [DatasourceType.postgres]: {},
    [DatasourceType.mssql]: {},
    [DatasourceType.mysql]: {
        type: "longtext",
        transformer: {
            to: (value: any) => (value !== undefined && value !== null ? JSON.stringify(value) : value),
            from: (value: any) => (value !== null && value !== undefined ? JSON.parse(value) : value),
        },
    },
    [DatasourceType.mariadb]: {
        type: "longtext",
        transformer: {
            to: (value: any) => (value !== undefined && value !== null ? JSON.stringify(value) : value),
            from: (value: any) => (value !== null && value !== undefined ? JSON.parse(value) : value),
        },
    },
    [DatasourceType.oracle]: { type: "clob" },
};

const FLOAT_MAP: Record<DatasourceType, ColumnOptions> = {
    [DatasourceType.postgres]: { type: "float4" },
    [DatasourceType.mssql]: { type: "float" },
    [DatasourceType.mysql]: { type: "float" },
    [DatasourceType.mariadb]: { type: "float" },
    [DatasourceType.oracle]: { type: "float" },
};

const solidCoreDbType: DatasourceType =
    Object.values(DatasourceType).includes(process.env.SOLID_CORE_DB_TYPE as DatasourceType)
        ? (process.env.SOLID_CORE_DB_TYPE as DatasourceType)
        : DatasourceType.postgres;

export function getColumnType(solidType: string): ColumnOptions {
    switch (solidType) {
        case "longText":
        case "richText":
            return LONG_TEXT_MAP[solidCoreDbType];

        case "simpleJsonLargeText":
            return SIMPLE_JSON_LARGE_TEXT_MAP[solidCoreDbType];

        case "float":
            return FLOAT_MAP[solidCoreDbType];

        default:
            return {};
    }
}
import { ColumnOptions } from "typeorm";
import { DatasourceType } from "src/dtos/create-model-metadata.dto";

const LONG_TEXT_MAP: Record<DatasourceType, ColumnOptions> = {
    [DatasourceType.postgres]: { type: "text" },
    [DatasourceType.mssql]: { type: "nvarchar", length: "max" },
    [DatasourceType.mysql]: { type: "longtext" },
    [DatasourceType.mariadb]: { type: "longtext" },
    [DatasourceType.oracle]: { type: "clob" },
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

        default:
            return {};
    }
}
import { Exclude, Expose } from "class-transformer";
import { Column, Generated } from "typeorm";
import { LEGACY_TABLE_FIELDS_PREFIX, LegacyCommonEntity } from "./legacy-common.entity";

@Exclude()
export abstract class LegacyCommonWithIdEntity extends LegacyCommonEntity  {
    @Expose()
    @Column({ type: 'integer', name: `${LEGACY_TABLE_FIELDS_PREFIX}_id`, unique: true })
    @Generated("increment")
    id: number
}
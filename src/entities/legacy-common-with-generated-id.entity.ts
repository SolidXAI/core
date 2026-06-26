import { Exclude, Expose } from "class-transformer";
import { Column, Generated } from "typeorm";
import { LEGACY_TABLE_FIELDS_PREFIX, LegacyCommonEntityWithExistingId } from "./legacy-common.entity-with-existing-id.entity";

@Exclude()
export abstract class LegacyCommonEntityWithGeneratedId extends LegacyCommonEntityWithExistingId  {
    @Expose()
    @Column({ type: 'integer', name: `${LEGACY_TABLE_FIELDS_PREFIX}_id`, unique: true })
    @Generated("increment")
    id: number
}
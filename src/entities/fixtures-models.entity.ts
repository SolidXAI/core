import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';
import { Fixtures } from 'src/entities/fixtures.entity'

@Entity('ss_fixtures_models')
export class FixturesModels extends CommonEntity {
    @Index()
    @ManyToOne(() => Fixtures, { onDelete: "RESTRICT", nullable: false })
    @JoinColumn()
    fixture: Fixtures;
    @Index()
    @Column({ type: "varchar" })
    modelName: string;
    @Column({ type: "simple-json" })
    modelData: any;
    @Column({ type: "integer", nullable: true })
    modelId: number;
}
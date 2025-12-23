import { CommonEntity } from 'src/entities/common.entity';
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';
import { Fixture } from 'src/entities/fixture.entity'

@Entity('ss_fixture_model')
export class FixtureModel extends CommonEntity {
    @Index()
    @ManyToOne(() => Fixture, { onDelete: "RESTRICT", nullable: false })
    @JoinColumn()
    fixture: Fixture;
    @Column({ type: "simple-json" })
    modelData: any;
    @Column({ type: "integer", nullable: true })
    modelId: number;
    @Index()
    @Column({})
    modelSingularName: string;
}
import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index, OneToMany } from 'typeorm';
import { FixtureModel } from 'src/entities/fixture-model.entity'

@Entity('ss_fixture')
@Index(['moduleName', 'scenarioName'], { unique: true })
export class Fixture extends CommonEntity {
    @Index()
    @Column({})
    moduleName: string;
    @Index()
    @Column({})
    scenarioName: string;
    @Column({ nullable: true })
    scenarioDescription: string;
    @Column({ type: "simple-json" })
    data: any;
    @Index({ unique: true })
    @Column({})
    checksum: string;
    @Index()
    @Column({})
    status: string;
    @OneToMany(() => FixtureModel, fixtureModel => fixtureModel.fixture, { cascade: true })
    fixtureModels: FixtureModel[];
}
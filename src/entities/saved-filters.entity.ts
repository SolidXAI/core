import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, JoinColumn, ManyToOne, Index } from 'typeorm';
import { User } from 'src/entities/user.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ViewMetadata } from 'src/entities/view-metadata.entity'
import { getColumnType } from 'src/helpers/typeorm-db-helper';

@Entity("ss_saved_fitlers")
export class SavedFilters extends CommonEntity {
    @Column({ nullable: true, ...getColumnType('longText') })
    filterQueryJson: any;

    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Column({ nullable: true, default: false })
    isPrivate: boolean = false;

    @Index()
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;

    @Index()
    @ManyToOne(() => ModelMetadata, { nullable: false })
    @JoinColumn()
    model: ModelMetadata;

    @Index()
    @ManyToOne(() => ViewMetadata, { nullable: false })
    @JoinColumn()
    view: ViewMetadata;

    @Column({ name: "description", nullable: true })
    description: string;

    @Column({ nullable: true, default: false })
    isSeeded: boolean = false;
}

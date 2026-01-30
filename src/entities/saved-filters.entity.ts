import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, JoinColumn, ManyToOne, Index } from 'typeorm';
import { User } from 'src/entities/user.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ViewMetadata } from 'src/entities/view-metadata.entity'

@Entity("ss_saved_fitlers")
export class SavedFilters extends CommonEntity {
    @Column({ type: "text", nullable: true })
    filterQueryJson: any;

    @Index({ unique: true })
    @Column({ type: "varchar" })
    name: string;

    @Column({ nullable: true, default: false })
    isPrivate: boolean = false;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn()
    user: User;

    @ManyToOne(() => ModelMetadata, { nullable: false })
    @JoinColumn()
    model: ModelMetadata;

    @ManyToOne(() => ViewMetadata, { nullable: false })
    @JoinColumn()
    view: ViewMetadata;

    @Column({ name: "description", type: "text", nullable: true })
    description: string;
}

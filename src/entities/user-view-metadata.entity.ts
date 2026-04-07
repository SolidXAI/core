import { CommonEntity } from 'src/entities/common.entity'
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';
import { getColumnType } from 'src/helpers/typeorm-db-helper';
import { ViewMetadata } from 'src/entities/view-metadata.entity';
import { User } from 'src/entities/user.entity'

@Entity("ss_user_view_metadata")
export class UserViewMetadata extends CommonEntity {
    @Index()
    @ManyToOne(() => User, { nullable: false })
    @JoinColumn()
    user: User;
    @Column({ name: "layout", nullable: true, ...getColumnType('longText') })
    layout: any = "{}";
    @Index()
    @ManyToOne(() => ViewMetadata, { nullable: false })
    @JoinColumn()
    viewMetadata: ViewMetadata;
}
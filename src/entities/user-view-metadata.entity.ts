import { CommonEntity } from 'src/entities/common.entity'
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';
import { ViewMetadata } from 'src/entities/view-metadata.entity';
import { User } from 'src/entities/user.entity'

@Entity("ss_user_view_metadata")
export class UserViewMetadata extends CommonEntity {
    @Index()
    @ManyToOne(() => User, { nullable: false })
    @JoinColumn()
    user: User;
    @Column({ name: "layout", type: "text", nullable: true })
    layout: any = "{}";
    @Index()
    @ManyToOne(() => ViewMetadata, { nullable: false })
    @JoinColumn()
    viewMetadata: ViewMetadata;
}
import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, JoinColumn, ManyToOne} from 'typeorm';
import { User } from 'src/entities/user.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ViewMetadata } from 'src/entities/view-metadata.entity'
@Entity("ss_saved_fitlers")
export class SavedFilters extends CommonEntity{
@Column({ type: "text", nullable: true })
filterQueryJson: string;

@Column({ type: "varchar" })
name: string;

@Column({ type: "boolean", nullable: true, default: false })
isPrivate: boolean = false;

@ManyToOne(() => User, { onDelete: "RESTRICT", nullable: false })
@JoinColumn()
user: User;

@ManyToOne(() => ModelMetadata, { onDelete: "RESTRICT", nullable: false })
@JoinColumn()
model: ModelMetadata;

@ManyToOne(() => ViewMetadata, { onDelete: "RESTRICT", nullable: false })
@JoinColumn()
view: ViewMetadata;
}
import { Exclude, Expose } from "class-transformer";
import { CommonEntity } from "src/entities/common.entity";
import { Column, Entity, Index, ManyToOne } from "typeorm";
import { User } from "./user.entity";

@Entity("ss_user_api_key")
@Exclude()
export class UserApiKey extends CommonEntity {

    @Expose()
    @Column({ type: "varchar" })
    name: string;

    // SHA-256 hash of the raw key — never exposed, same treatment as User.password
    @Index({ unique: true })
    @Column({ type: "varchar" })
    hashedKey: string;

    @Expose()
    @Column({ type: "varchar" })
    maskedKey: string;

    @Expose()
    @Column({ default: true })
    isActive: boolean;

    @Expose()
    @Column({ nullable: true })
    expiresAt: Date;

    @Expose()
    @Column({ nullable: true })
    lastUsedAt: Date;

    @ManyToOne(() => User, user => user.apiKeys)
    user: User;
}

import { CommonEntity } from 'src/entities/common.entity';
import { User } from 'src/entities/user.entity';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

@Entity("ss_user_password_history")
export class UserPasswordHistory extends CommonEntity {
    @Column({ unique: true })
    passwordHash: string;

    @Index()
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    user: User;

}
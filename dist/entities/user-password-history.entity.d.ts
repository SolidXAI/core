import { CommonEntity } from 'src/entities/common.entity';
import { User } from 'src/entities/user.entity';
export declare class UserPasswordHistory extends CommonEntity {
    passwordHash: string;
    user: User;
}

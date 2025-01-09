import { User } from "../entities/user.entity";
import { EventDetails } from "../interfaces";
export declare class UserRegistrationListener {
    private logger;
    handleUserRegistration(event: EventDetails<User>): void;
}

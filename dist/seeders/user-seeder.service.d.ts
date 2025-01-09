import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
export declare class UserSeederService {
    private readonly authenticationService;
    private readonly userService;
    private readonly logger;
    constructor(authenticationService: AuthenticationService, userService: UserService);
    seed(): Promise<void>;
}

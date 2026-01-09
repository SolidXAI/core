import { Injectable, Logger } from '@nestjs/common';
import { AuthenticationService } from '../services/authentication.service';
import { UserService } from '../services/user.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserSeederService {
    private readonly logger = new Logger(UserSeederService.name);

    constructor(
        private readonly authenticationService: AuthenticationService,
        private readonly userService: UserService,
    ) { }

    async seed() {
        // see if the user already exists, 
        let user = await this.userService.findOneByUsername("sa");

        if (!user) {
            user = await this.authenticationService.signUp({
                username: 'sa',
                email: 'sa@solidxai.com',
                password: uuidv4(),
            });    

            this.logger.log(`Newly created user is ${user}`);
        }

        // now make this user an Admin by adding them to the Admin role group. 
        await this.userService.addRoleToUser(user.email, "Admin");
        await this.userService.addRoleToUser(user.email, "Public");
    }
}
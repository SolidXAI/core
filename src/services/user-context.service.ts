import { Injectable, Logger } from '@nestjs/common';
import { ActiveUserData } from '../interfaces/active-user-data.interface';

@Injectable()
export class UserContextService {
    private readonly logger = new Logger(UserContextService.name);
    private static currentUser: any = null;

    setUser(user: any) {
        this.logger.debug(`Setting user: ${JSON.stringify(user)}`);
        UserContextService.currentUser = user;
    }

    getUser() {
        return UserContextService.currentUser;
    }

    runWithUser<T>(user: any, callback: () => T): T {
        const previousUser = this.getUser();
        try {
            this.setUser(user);
            return callback();
        } finally {
            this.setUser(previousUser);
        }
    }

    getCurrentUser(): ActiveUserData | null {
        return this.getUser();
    }
}
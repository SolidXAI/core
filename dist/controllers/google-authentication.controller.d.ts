import { AuthenticationService } from '../services/authentication.service';
import { Request, Response } from 'express';
import { ConfigType } from '@nestjs/config';
import { UserService } from '../services/user.service';
import { iamConfig } from '../config/iam.config';
export declare class GoogleAuthenticationController {
    private iamConfiguration;
    private readonly userService;
    private readonly authService;
    constructor(iamConfiguration: ConfigType<typeof iamConfig>, userService: UserService, authService: AuthenticationService);
    connect(): Promise<void>;
    googleAuthCallback(req: Request, res: Response): void;
    dummyGoogleAuthRedirect(accessCode: any): Promise<import("..").User>;
    googleAuth(accessCode: any): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
}

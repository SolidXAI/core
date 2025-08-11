import { HttpService } from '@nestjs/axios';
import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { isEmpty, isNotEmpty } from 'class-validator';
import { randomInt, randomUUID } from 'crypto';
import { SMTPEMailService } from 'src/services/mail/smtp-email.service';
import { Msg91OTPService } from 'src/services/sms/Msg91OTPService';
import { Repository } from 'typeorm';
import { iamConfig, jwtConfig } from '../config/iam.config';
import { ChangePasswordDto } from "../dtos/change-password.dto";
import { ConfirmForgotPasswordDto } from '../dtos/confirm-forgot-password.dto';
import { InitiateForgotPasswordDto } from '../dtos/initiate-forgot-password.dto';
import { OTPConfirmOTPDto } from '../dtos/otp-confirm-otp.dto';
import { OTPSignInDto } from '../dtos/otp-sign-in.dto';
import { OTPSignUpDto } from '../dtos/otp-sign-up.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { SignInDto } from '../dtos/sign-in.dto';
import { SignUpDto } from '../dtos/sign-up.dto';
import { UserPasswordHistory } from '../entities/user-password-history.entity';
import { User } from '../entities/user.entity';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { HashingService } from './hashing.service';
import { InvalidatedRefreshTokenError, RefreshTokenIdsStorageService } from './refresh-token-ids-storage.service';
import { UserService } from './user.service';
import { EventDetails, EventType, IMail } from "../interfaces";
import {
    ForgotPasswordSendVerificationTokenOn,
    RegistrationValidationSource,
    TransactionalRegistrationValidationSource
} from "../constants";
import { SettingService } from './setting.service';
import { CreateUserDto } from 'src/dtos/create-user.dto';
import { RoleMetadataService } from './role-metadata.service';
import commonConfig from 'src/config/common.config';
import { UserActivityHistoryService } from './user-activity-history.service';
import { RequestContextService } from './request-context.service';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { SUCCESS_MESSAGES } from 'src/constants/success-messages';
import { MailFactory } from 'src/factories/mail.factory';


enum LoginProvider {
    LOCAL = 'local',
    GOOGLE = 'google',
    OTP = 'otp',
}

interface otp {
    token: string;
    expiresAt: Date;
}

@Injectable()
export class AuthenticationService {
    private readonly logger = new Logger(AuthenticationService.name);
    // private readonly mailService: IMail;
    constructor(
        private readonly userService: UserService,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @InjectRepository(UserPasswordHistory) private readonly userPasswordHistoryRepository: Repository<UserPasswordHistory>,
        private readonly hashingService: HashingService,
        private readonly jwtService: JwtService,
        @Inject(jwtConfig.KEY)
        private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
        @Inject(iamConfig.KEY)
        private readonly iamConfiguration: ConfigType<typeof iamConfig>,
        private readonly refreshTokenIdsStorage: RefreshTokenIdsStorageService,
        private readonly httpService: HttpService,
        // private readonly mailService: SMTPEMailService,
        private readonly mailServiceFactory: MailFactory,
        private readonly smsService: Msg91OTPService,
        private readonly eventEmitter: EventEmitter2,
        private readonly settingService: SettingService,
        private readonly roleMetadataService: RoleMetadataService,
        @Inject(commonConfig.KEY)
        private readonly commonConfiguration: ConfigType<typeof commonConfig>,
        private readonly userActivityHistoryService: UserActivityHistoryService,
        private readonly requestContextService: RequestContextService,
    ) {
        // this.mailService = this.mailServiceFactory.getMailService();
     }

    private async getConfig(key: string): Promise<any> {
        return this.settingService.getConfigValue(key);
    }

    private async getCompanyLogo(): Promise<string> {
        return await this.settingService.getConfigValue('companylogo');
    }

    async resolveUser(username: string, email: string) {
        return await this.userRepository.findOne({
            where: [
                { username: username },
                { email: email },
            ],
            relations: {
                roles: true
            }
        });
    }

    async validateUser(signInDto: SignInDto) {

        const user = await this.resolveUser(signInDto.username, signInDto.email);

        if (!user) {
            throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (!user.active) {
            throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_ACTIVE);
        }
        const isEqual = await this.hashingService.compare(
            signInDto.password,
            user.password,
        );
        if (!isEqual) {
            throw new UnauthorizedException(ERROR_MESSAGES.PASSWORD_INCORRECT);
        }

        return user;
    }

    async signUp(signUpDto: SignUpDto, activeUser: ActiveUserData = null): Promise<User> {
        // If public registrations are disabled and no activeUser is present when invoking signUp then we throw an exception.
        if (!(await this.settingService.getConfigValue('allowPublicRegistration')) && !activeUser) {
            throw new BadRequestException(ERROR_MESSAGES.PUBLIC_REGISTRATION_DISABLED);
        }

        try {
            const onForcePasswordChange = await this.getConfig('forceChangePasswordOnFirstLogin');
            var { user, pwd, autoGeneratedPwd } = await this.populateForSignup(new User(), signUpDto, this.iamConfiguration.activateUserOnRegistration, onForcePasswordChange);
            const savedUser = await this.userRepository.save(user);
            // Also assign a default role to the newly created user. 
            const userRoles = signUpDto.roles ?? [];
            if (this.iamConfiguration.defaultRole) {
                userRoles.push(this.iamConfiguration.defaultRole);
            }
            await this.handlePostSignup(savedUser, userRoles, pwd, autoGeneratedPwd);

            // TODO: make provision to trigger a welcome email also.

            return savedUser;
        } catch (err) {
            const pgUniqueViolationErrorCode = '23505';
            if (err.code === pgUniqueViolationErrorCode) {
                throw new ConflictException(ERROR_MESSAGES.USER_ALREADY_EXISTS);
            }
            throw err;
        }
    }

    async signupForExtensionUser<T extends User, U extends CreateUserDto>(signUpDto: SignUpDto, extensionUserDto: U, extensionUserRepo: Repository<T>): Promise<T> {
        try {
            const onForcePasswordChange = await this.getConfig('forceChangePasswordOnFirstLogin');
            // Merge the extended signUpDto attributes into the user entity 
            //@ts-ignore 
            const extensionUser = extensionUserRepo.merge(extensionUserRepo.create() as T, extensionUserDto);
            var { user, pwd, autoGeneratedPwd } = await this.populateForSignup<T>(extensionUser, signUpDto, true, onForcePasswordChange);
            const savedUser = await extensionUserRepo.save(user);

            await this.handlePostSignup(savedUser, signUpDto.roles, pwd, autoGeneratedPwd);

            return savedUser;
        }
        catch (err) {
            const pgUniqueViolationErrorCode = '23505';
            if (err.code === pgUniqueViolationErrorCode) {
                throw new ConflictException(parseUniqueConstraintError(err.detail || ERROR_MESSAGES.UNIQUE_CONSTRAINT_VIOLATION));
            }
            throw err;
        }
    }


    private async populateForSignup<T extends User>(user: T, signUpDto: SignUpDto, isUserActive: boolean = true, onForcePasswordChange?: boolean) {
        // const user = new User();

        if (signUpDto.roles && signUpDto.roles.length > 0) {
            for (let i = 0; i < signUpDto.roles.length; i++) {
                const roleName = signUpDto.roles[i];
                await this.roleMetadataService.findRoleByName(roleName);
            }
        }
        user.username = signUpDto.username;
        user.email = signUpDto.email;
        user.fullName = signUpDto.fullName;
        user.forcePasswordChange = onForcePasswordChange;
        if (signUpDto.mobile) {
            user.mobile = signUpDto.mobile;
        }
        this.logger.debug("user", user);
        // If password has been specified by the user, then we simply create & activate the user based on the configuration parameter "activateUserOnRegistration".
        let pwd = '';
        let autoGeneratedPwd = '';
        if (signUpDto.password) {
            pwd = await this.hashingService.hash(signUpDto.password);
        }
        else {
            // TODO: If password is not specified then auto-generate a random password, trigger this password over an email to the user.
            // TODO: Also track if the user has to force reset / change their password, and then activate the user. 
            autoGeneratedPwd = this.generatePassword();
            pwd = await this.hashingService.hash(autoGeneratedPwd);
            user.forcePasswordChange = true;
        }
        user.password = pwd;
        // user.active = this.iamConfiguration.activateUserOnRegistration;
        user.active = isUserActive;
        return { user, pwd, autoGeneratedPwd };
    }


    private async handlePostSignup(user: User, roles: string[] = [], pwd: string, autoGeneratedPwd: string) {
        await this.userService.initializeRolesForNewUser(roles, user);
        // Tanay: Adding user password to history table
        const userPasswordHistory = new UserPasswordHistory();
        userPasswordHistory.passwordHash = pwd;
        userPasswordHistory.user = user;
        await this.userPasswordHistoryRepository.save(userPasswordHistory);

        // if forcePasswordChange is true, then we trigger an email to the user to change the password, this needs to be done using a queue. 
        // Create a new method like notifyUserOnForcePasswordChange, create a new email template we can call it on-force-password-change this template to include the random password
        if (user.forcePasswordChange && autoGeneratedPwd) {
            this.notifyUserOnForcePasswordChange(user, autoGeneratedPwd);
        }
    }


    generatePassword(length: number = 8): string {
        const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const lowerCase = "abcdefghijklmnopqrstuvwxyz";
        const numbers = "0123456789";
        const specialChars = "@$#";
        const allChars = upperCase + lowerCase + numbers + specialChars;

        let password = "";

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * allChars.length);
            password += allChars[randomIndex];
        }

        return password;
    }

    private async notifyUserOnForcePasswordChange(user: User, autoGeneratedPwd: string) {
        const companyLogo = await this.getCompanyLogo();
        const mailService = this.mailServiceFactory.getMailService();
        mailService.sendEmailUsingTemplate(
            user.email,
            'on-force-password-change',
            {
                solidAppName: process.env.SOLID_APP_NAME,
                solidAppWebsiteUrl: process.env.SOLID_APP_WEBSITE_URL,
                frontendLoginPageUrl: process.env.IAM_FRONTEND_APP_LOGIN_PAGE_URL,
                email: user.email,
                fullName: user.fullName,
                userName: user.username,
                password: autoGeneratedPwd,
                companyLogoUrl: companyLogo
            },
            this.commonConfiguration.shouldQueueEmails,
            null,
            null,
            'user',
            user.id
        );

    }

    async otpInitiateRegistration(signUpDto: OTPSignUpDto) {
        try {
            if (!this.isPasswordlessRegistrationEnabled()) {
                throw new BadRequestException(ERROR_MESSAGES.PASSWORDLESS_REGISTRATION_DISABLED);
            }
            // Validate if either mobile or email is present.
            if (isEmpty(signUpDto.mobile) && isEmpty(signUpDto.email)) {
                throw new BadRequestException(ERROR_MESSAGES.REGISTRATION_REQUIRES_CONTACT);
            }
            if (signUpDto.validationSources.includes(TransactionalRegistrationValidationSource.EMAIL) && isEmpty(signUpDto.email)) {
                throw new BadRequestException(ERROR_MESSAGES.EMAIL_REQUIRED_FOR_VALIDATION);
            }
            if (signUpDto.validationSources.includes(TransactionalRegistrationValidationSource.MOBILE) && isEmpty(signUpDto.mobile)) {
                throw new BadRequestException(ERROR_MESSAGES.MOBILE_REQUIRED_FOR_VALIDATION);
            }

            // Validate if user already exists.
            const existingUser = await this.userRepository.findOne({ //TODO Perhaps we should use the user service instead of the repository directly.
                where: [
                    { email: signUpDto.email, },
                    { mobile: signUpDto.mobile, },
                    { username: signUpDto.username, }
                ]
            });
            if (isNotEmpty(existingUser) && existingUser.active) {
                throw new ConflictException(ERROR_MESSAGES.USER_ALREADY_EXISTS);
            }
            const finalRegistrationVerificationSources = this.calculateVerificationSources(this.iamConfiguration.passwordlessRegistrationValidateWhat, signUpDto);
            let user = existingUser
            if (isEmpty(user)) {
                user = this.createUser(signUpDto);
                this.populateVerificationTokens(finalRegistrationVerificationSources, user);
                await this.userRepository.save(user);
                await this.userService.addRoleToUser(user.username, await this.settingService.getConfigValue('defaultRole'));
            }
            else {
                this.populateVerificationTokens(finalRegistrationVerificationSources, user);
                await this.userRepository.save(user);
            }

            // Send OTP to the user through email or SMS, depending on the configuration.
            this.notifyUserOnOtpInitiateRegistration(user, finalRegistrationVerificationSources);
            return { message: SUCCESS_MESSAGES.OTP_SENT_SUCCESS_REGISTRATION }
        } catch (err) {
            const pgUniqueViolationErrorCode = '23505';
            if (err.code === pgUniqueViolationErrorCode) {
                throw new ConflictException(ERROR_MESSAGES.USER_ALREADY_EXISTS);
            }
            throw err;
        }
    }

    // Create a new user entity.
    private createUser(signUpDto: OTPSignUpDto) {
        const user = new User();
        user.username = signUpDto.username;
        user.email = signUpDto.email;
        user.mobile = signUpDto.mobile;
        user.customPayload = signUpDto.customPayload;
        user.lastLoginProvider = LoginProvider.OTP;
        return user;
    }

    private calculateVerificationSources(configuredRegistrationValidationSources: string[], signUpDto: OTPSignUpDto): string[] {
        const finalRegistrationValidationSources = configuredRegistrationValidationSources.filter((source) => source !== RegistrationValidationSource.TRANSACTIONAL);
        if (configuredRegistrationValidationSources.includes(RegistrationValidationSource.TRANSACTIONAL)) {
            finalRegistrationValidationSources.push(...signUpDto.validationSources); // Add the validation sources provided by the user.
        }
        return finalRegistrationValidationSources;
    }

    // Generate the validation tokens for the user i.e (system configured + user provided)
    private populateVerificationTokens(finalRegistrationValidationSources: string[], user: User) {
        if (finalRegistrationValidationSources.length === 0) {
            throw new BadRequestException(ERROR_MESSAGES.VALIDATION_SOURCE_REQUIRED);
        }
        if (finalRegistrationValidationSources.includes(TransactionalRegistrationValidationSource.EMAIL)) {
            const { token, expiresAt } = this.otp();
            user.emailVerificationTokenOnRegistration = token;
            user.emailVerificationTokenOnRegistrationExpiresAt = expiresAt;
            if (this.iamConfiguration.autoLoginUserOnRegistration) {
                user.emailVerificationTokenOnLogin = token;
                user.emailVerificationTokenOnLoginExpiresAt = expiresAt;
            }
        }
        if (finalRegistrationValidationSources.includes(TransactionalRegistrationValidationSource.MOBILE)) {
            const { token, expiresAt } = this.otp();
            user.mobileVerificationTokenOnRegistration = token;
            user.mobileVerificationTokenOnRegistrationExpiresAt = expiresAt;
            if (this.iamConfiguration.autoLoginUserOnRegistration) {
                user.mobileVerificationTokenOnLogin = token;
                user.mobileVerificationTokenOnLoginExpiresAt = expiresAt;
            }
        }
    }

    private async notifyUserOnOtpInitiateRegistration(user: User, registrationValidationSources: string[]) {
        const companyLogo = await this.getCompanyLogo();
        if (this.iamConfiguration.dummyOtp)
            return; // Do nothing if dummy otp is configured.
        if (registrationValidationSources.includes(RegistrationValidationSource.EMAIL)) {
            const mailService = this.mailServiceFactory.getMailService();
            mailService.sendEmailUsingTemplate(
                user.email,
                'otp-on-register',
                {
                    solidAppName: process.env.SOLID_APP_NAME,
                    solidAppWebsiteUrl: process.env.SOLID_APP_WEBSITE_URL,
                    firstName: user.username,
                    fullName: user.fullName ? user.fullName : user.username,
                    emailVerificationTokenOnRegistration: user.emailVerificationTokenOnRegistration,
                    companyLogoUrl: companyLogo
                },
                this.commonConfiguration.shouldQueueEmails,
                null,
                null,
                'user',
                user.id
            );
        }
        if (registrationValidationSources.includes(RegistrationValidationSource.MOBILE)) {
            this.smsService.sendSMSUsingTemplate(
                user.mobile,
                'otp-on-register',
                {
                    solidAppName: process.env.SOLID_APP_NAME,
                    otp: user.mobileVerificationTokenOnRegistration,
                    mobileVerificationTokenOnRegistration: user.mobileVerificationTokenOnRegistration,
                    firstName: user.username,
                    fullName: user.fullName ? user.fullName : user.username,
                    companyLogoUrl: companyLogo
                }
            );
        }
    }

    async otpConfirmRegistration(confirmSignUpDto: OTPConfirmOTPDto) {
        if (!this.isPasswordlessRegistrationEnabled()) {
            throw new BadRequestException(ERROR_MESSAGES.PASSWORDLESS_REGISTRATION_DISABLED);
        }

        // Based on the identifier, validate by query the user table.
        if (confirmSignUpDto.type === RegistrationValidationSource.EMAIL) {
            const user = await this.userRepository.findOne({
                where: {
                    email: confirmSignUpDto.identifier,
                }
            });
            if (!user) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (user.emailVerificationTokenOnRegistration !== confirmSignUpDto.otp) {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_OTP);
            }
            if (user.emailVerificationTokenOnRegistrationExpiresAt < new Date()) {
                throw new UnauthorizedException(ERROR_MESSAGES.OTP_EXPIRED);
            }
            user.emailVerifiedOnRegistrationAt = new Date();
            user.emailVerificationTokenOnRegistration = null;
            user.emailVerificationTokenOnRegistrationExpiresAt = null;
            user.active = await this.settingService.getConfigValue('activateUserOnRegistration') && this.areRegistrationValidationSourcesVerified(user);
            const savedUser: User = await this.userRepository.save(user);
            this.triggerRegistrationEvent(savedUser);
            return { active: savedUser.active, message: `User registration verified for ${confirmSignUpDto.type}` }
        } else if (confirmSignUpDto.type === RegistrationValidationSource.MOBILE) {
            const user = await this.userRepository.findOne({
                where: {
                    mobile: confirmSignUpDto.identifier,
                }
            });
            if (!user) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (user.mobileVerificationTokenOnRegistration !== confirmSignUpDto.otp) {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_OTP);
            }
            if (user.mobileVerificationTokenOnRegistrationExpiresAt < new Date()) {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_OTP);
            }
            user.mobileVerifiedOnRegistrationAt = new Date();
            user.mobileVerificationTokenOnRegistration = null;
            user.mobileVerificationTokenOnRegistrationExpiresAt = null;
            user.active = await this.settingService.getConfigValue('activateUserOnRegistration') && this.areRegistrationValidationSourcesVerified(user);
            const savedUser: User = await this.userRepository.save(user);
            this.triggerRegistrationEvent(savedUser);
            return { active: savedUser.active, message: `User registration verified for ${confirmSignUpDto.type}` }
        }
        throw new BadRequestException(ERROR_MESSAGES.INVALID_VERIFICATION_TYPE);
    }

    private triggerRegistrationEvent(savedUser: User) {
        // Trigger events for user registration.
        const event = new EventDetails<User>(EventType.USER_REGISTERED, savedUser);
        this.eventEmitter.emit(EventType.USER_REGISTERED, event);
    }

    areRegistrationValidationSourcesVerified(user: User): boolean {
        const registrationValidationSources = this.iamConfiguration.passwordlessRegistrationValidateWhat;
        if (registrationValidationSources.includes(RegistrationValidationSource.EMAIL)) {
            if (!user.emailVerifiedOnRegistrationAt) {
                return false;
            }
        }
        if (registrationValidationSources.includes(RegistrationValidationSource.MOBILE)) {
            if (!user.mobileVerifiedOnRegistrationAt) {
                return false;
            }
        }
        return true;
    }

    private otp(): otp {
        const now = new Date();
        now.setMinutes(now.getMinutes() + this.iamConfiguration.otpExpiry);
        return {
            token: this.iamConfiguration.dummyOtp ? this.iamConfiguration.dummyOtp : randomInt(100000, 999999).toString(),
            expiresAt: now,
        };
    }

    async signIn(signInDto: SignInDto) {
        const user = await this.validateUser(signInDto);

        // TODO: Unset the password etc...
        const tokens = await this.generateTokens(user);

        await this.userActivityHistoryService.logEvent('login', user);

        return {
            user: {
                email: user.email,
                mobile: user.mobile,
                username: user.username,
                forcePasswordChange: user.forcePasswordChange,
                id: user.id,
                roles: user.roles.map((role, idx, roles) => role.name)
            },
            ...tokens
        }
    }

    async otpInitiateLogin(signInDto: OTPSignInDto) {
        if (!this.isPasswordlessRegistrationEnabled()) {
            throw new BadRequestException(ERROR_MESSAGES.PASSWORDLESS_REGISTRATION_DISABLED);
        }

        // Validate & generate otp token for the user based on the identifier type.
        if (signInDto.type === RegistrationValidationSource.EMAIL) {
            const user = await this.userRepository.findOne({
                where: {
                    email: signInDto.identifier,
                }
            });
            if (!user) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!user.active) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_INACTIVE);
            }
            const { token, expiresAt } = this.otp();
            user.emailVerificationTokenOnLogin = token;
            user.emailVerificationTokenOnLoginExpiresAt = expiresAt;
            await this.userRepository.save(user);
            this.notifyUserOnOtpInititateLogin(user, RegistrationValidationSource.EMAIL);
        } else if (signInDto.type === RegistrationValidationSource.MOBILE) {
            const user = await this.userRepository.findOne({
                where: {
                    mobile: signInDto.identifier,
                }
            });
            if (!user) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_FOUND);
            }

            const { token, expiresAt } = this.otp();
            user.mobileVerificationTokenOnLogin = token;
            user.mobileVerificationTokenOnLoginExpiresAt = expiresAt;
            await this.userRepository.save(user);
            this.notifyUserOnOtpInititateLogin(user, RegistrationValidationSource.MOBILE);
        }
        else {
            throw new BadRequestException(ERROR_MESSAGES.INVALID_VERIFICATION_TYPE);
        }
        return { message: SUCCESS_MESSAGES.OTP_SENT_SUCCESS_LOGIN };
    }

    private async notifyUserOnOtpInititateLogin(user: User, loginType: RegistrationValidationSource) {
        const companyLogo = await this.getCompanyLogo();

        if (this.iamConfiguration.dummyOtp)
            return; // Do nothing if dummy otp is configured.
        if (loginType === RegistrationValidationSource.EMAIL) {
            const mailService = this.mailServiceFactory.getMailService();
            mailService.sendEmailUsingTemplate(
                user.email,
                'otp-on-login',
                {
                    solidAppName: process.env.SOLID_APP_NAME,
                    solidAppWebsiteUrl: process.env.SOLID_APP_WEBSITE_URL,
                    firstName: user.username,
                    emailVerificationTokenOnLogin: user.emailVerificationTokenOnLogin,
                    fullName: user.fullName ? user.fullName : user.username,
                    companyLogoUrl: companyLogo
                },
                this.commonConfiguration.shouldQueueEmails,
                null,
                null,
                'user',
                user.id
            );
        }
        if (loginType === RegistrationValidationSource.MOBILE) {
            this.smsService.sendSMSUsingTemplate(
                user.mobile,
                'otp-on-login',
                {
                    solidAppName: process.env.SOLID_APP_NAME,
                    otp: user.mobileVerificationTokenOnLogin,
                    mobileVerificationTokenOnLogin: user.mobileVerificationTokenOnLogin,
                    firstName: user.username,
                    fullName: user.fullName ? user.fullName : user.username,
                    companyLogoUrl: companyLogo
                }
            );
        }
    }

    async otpConfirmLogin(confirmSignInDto: OTPConfirmOTPDto) {
        if (!this.isPasswordlessRegistrationEnabled()) {
            throw new BadRequestException(ERROR_MESSAGES.PASSWORDLESS_REGISTRATION_DISABLED);
        }
        if (confirmSignInDto.type === RegistrationValidationSource.EMAIL) {
            const user = await this.userRepository.findOne({
                where: {
                    email: confirmSignInDto.identifier,
                },
                relations: ['roles']
            });
            if (!user) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_FOUND);
            }
            if (!user.active) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_INACTIVE);
            }
            if (user.emailVerificationTokenOnLogin !== confirmSignInDto.otp) {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_OTP);
            }
            if (user.emailVerificationTokenOnLoginExpiresAt < new Date()) {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_OTP);
            }
            user.emailVerifiedOnLoginAt = new Date();
            user.emailVerificationTokenOnLogin = null;
            user.emailVerificationTokenOnLoginExpiresAt = null;
            await this.userRepository.save(user);
            const { accessToken, refreshToken } = await this.generateTokens(user);
            const { id, username, email, mobile, lastLoginProvider } = user;
            const roles = user.roles.map((role) => role.name);
            return { accessToken, refreshToken, user: { id, username, email, mobile, lastLoginProvider, roles } };
        } else if (confirmSignInDto.type === RegistrationValidationSource.MOBILE) {
            const user = await this.userRepository.findOne({
                where: {
                    mobile: confirmSignInDto.identifier,
                },
                relations: ['roles']
            });
            if (!user) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_NOT_ACTIVE);
            }
            if (!user.active) {
                throw new UnauthorizedException(ERROR_MESSAGES.USER_INACTIVE);
            }
            if (user.mobileVerificationTokenOnLogin !== confirmSignInDto.otp) {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_OTP);
            }
            if (user.mobileVerificationTokenOnLoginExpiresAt < new Date()) {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_OTP);
            }
            user.mobileVerifiedOnLoginAt = new Date();
            user.mobileVerificationTokenOnLogin = null;
            user.mobileVerificationTokenOnLoginExpiresAt = null;
            await this.userRepository.save(user);
            const { accessToken, refreshToken } = await this.generateTokens(user);
            const { id, username, email, mobile, lastLoginProvider } = user;
            const roles = user.roles.map((role) => role.name);
            return { accessToken, refreshToken, user: { id, username, email, mobile, lastLoginProvider, roles } };

        }
        throw new BadRequestException(ERROR_MESSAGES.INVALID_VERIFICATION_TYPE);
    }

    async changePassword(changePasswordDto: ChangePasswordDto, activeUser: ActiveUserData) {
        const user = await this.userRepository.findOne({
            where: { id: changePasswordDto.id }
        });
        if (!user) {
            throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        if (!user.active) {
            throw new UnauthorizedException(ERROR_MESSAGES.USER_INACTIVE);
        }

        // 2. Validate if user has used a provider which is "local", only then it makes sense for us to initiate the forgot password routine.
        if (user.lastLoginProvider !== 'local') {
            throw new BadRequestException(ERROR_MESSAGES.NON_LOCAL_PROVIDER);
        }

        // Check if ID's match
        if (!(user.id === activeUser.sub)) {
            throw new BadRequestException(ERROR_MESSAGES.USER_ID_MISMATCH);
        }

        // Check if username's match
        if (!(user.username === activeUser.username)) {
            throw new BadRequestException(ERROR_MESSAGES.USERNAME_MISMATCH);
        }

        // Check if old password is matching.
        const isEqual = await this.hashingService.compare(
            changePasswordDto.currentPassword,
            user.password,
        );
        if (!isEqual) {
            throw new UnauthorizedException(ERROR_MESSAGES.INCORRECT_CURRENT_PASSWORD);
        }

        // Update Password
        const newPwd = await this.hashingService.hash(changePasswordDto.newPassword);
        user.password = changePasswordDto.newPassword;

        // Everytime the user changes the password we reset the forcePasswordChange flag back to false. 
        user.forcePasswordChange = false;

        if (await this.isPasswordDuplicate(user)) {
            throw new BadRequestException(ERROR_MESSAGES.PASSWORD_REUSED);
        }
        await this.deleteOldPasswords(user);

        user.password = newPwd;
        const userPasswordHistory = new UserPasswordHistory();
        userPasswordHistory.passwordHash = newPwd;
        userPasswordHistory.user = user;

        await this.userRepository.save(user);
        await this.userPasswordHistoryRepository.save(userPasswordHistory);

        return true;
    }

    async initiateForgotPassword(initiateForgotPasswordDto: InitiateForgotPasswordDto) {
        // Steps / Algorithm: 
        // 1. Identify the user using the specified "username", if not found exit.
        // const user = await this.userRepository.findOne({
        //     where: { username: initiateForgotPasswordDto.username, }
        // });
        const user = await this.resolveUser(initiateForgotPasswordDto.username, initiateForgotPasswordDto.email);

        if (!user) {
            throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (!user.active) {
            throw new UnauthorizedException(ERROR_MESSAGES.USER_INACTIVE);
        }

        // 2. Validate if user has used a provider which is "local", only then it makes sense for us to initiate the forgot password routine. 
        if (user.lastLoginProvider !== 'local') {
            throw new BadRequestException(ERROR_MESSAGES.NON_LOCAL_PROVIDER);
        }

        // 3. Generate a 6 digit validation token, we send this token to the user over their email & mobile number (controlled using configuration).
        // 4. Save this validation token in new fields on the user record. 
        const { token, expiresAt } = this.otp();
        user.verificationTokenOnForgotPassword = token;
        user.verificationTokenOnForgotPasswordExpiresAt = expiresAt;
        await this.userRepository.save(user);
        this.notifyUserOnForgotPassword(user);

        // 5. Return. 
        return {
            status: 'success',
            message: SUCCESS_MESSAGES.FORGOT_PASSWORD_TOKEN_SENT,
            error: '',
            errorCode: '',
            data: {
                user: {
                    email: user.email,
                    mobile: user.mobile,
                    username: user.username,
                },
            }
        }
    }

    private async notifyUserOnForgotPassword(user: User) {
        const companyLogo = await this.getCompanyLogo();

        const forgotPasswordSendVerificationTokenOn = this.iamConfiguration.forgotPasswordSendVerificationTokenOn;

        if (forgotPasswordSendVerificationTokenOn == ForgotPasswordSendVerificationTokenOn.EMAIL) {
            const mailService = this.mailServiceFactory.getMailService();
            mailService.sendEmailUsingTemplate(
                user.email,
                'forgot-password',
                {
                    solidAppName: process.env.SOLID_APP_NAME,
                    solidAppWebsiteUrl: process.env.SOLID_APP_WEBSITE_URL,
                    firstName: user.username,
                    fullName: user.fullName,
                    // TODO: Need to prefix this with the page url where the forgot password page will open up.
                    passwordResetLink: `${process.env.IAM_FRONTEND_APP_FORGOT_PASSWORD_PAGE_URL}?token=${user.verificationTokenOnForgotPassword}&username=${user.username}`,
                    companyLogoUrl: companyLogo
                },
                this.commonConfiguration.shouldQueueEmails,
                null,
                null,
                'user',
                user.id
            );
        }
        // Assuming all users do not have mobile as mandatory.
        if (forgotPasswordSendVerificationTokenOn == ForgotPasswordSendVerificationTokenOn.MOBILE && user.mobile) {
            this.smsService.sendSMSUsingTemplate(
                user.mobile,
                'forgot-password',
                {
                    solidAppName: process.env.SOLID_APP_NAME,
                    otp: user.verificationTokenOnForgotPassword,
                    verificationTokenOnForgotPassword: user.verificationTokenOnForgotPassword,
                    firstName: user.username,
                    companyLogoUrl: companyLogo
                }
            );
        }
    }

    async confirmForgotPassword(confirmForgotPasswordDto: ConfirmForgotPasswordDto) {
        // Steps / Algorithm: 
        // 1. Identify the user using the specified "username", if not found exit.
        // const user = await this.userRepository.findOne({
        //     where: { username: confirmForgotPasswordDto.username, }
        // });
        const user = await this.resolveUser(confirmForgotPasswordDto.username, confirmForgotPasswordDto.email);

        if (!user) {
            throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        // 2. Validate if user has used a provider which is "local", only then it makes sense for us to initiate the forgot password routine. 
        if (user.lastLoginProvider !== 'local') {
            throw new BadRequestException(ERROR_MESSAGES.NON_LOCAL_PROVIDER);
        }
        if (!user.active) {
            throw new UnauthorizedException(ERROR_MESSAGES.USER_INACTIVE);
        }

        // 3. Validate the verification token is proper & update the user record. 
        if (user.verificationTokenOnForgotPassword !== confirmForgotPasswordDto.verificationToken) {
            throw new UnauthorizedException(ERROR_MESSAGES.INVALID_VERIFICATION_TOKEN);
        }
        if (user.verificationTokenOnForgotPasswordExpiresAt < new Date()) {
            throw new UnauthorizedException(ERROR_MESSAGES.INVALID_VERIFICATION_TOKEN);
        }
        user.forgotPasswordConfirmedAt = new Date();
        user.verificationTokenOnForgotPassword = null;
        user.verificationTokenOnForgotPasswordExpiresAt = null;

        // 4. Update the users password while encrypting it.
        const pwd = await this.hashingService.hash(confirmForgotPasswordDto.password);
        user.password = confirmForgotPasswordDto.password

        if (await this.isPasswordDuplicate(user)) {
            throw new BadRequestException(ERROR_MESSAGES.PASSWORD_REUSED);
        }
        await this.deleteOldPasswords(user);

        user.password = pwd;
        const userPasswordHistory = new UserPasswordHistory();
        userPasswordHistory.passwordHash = pwd;
        userPasswordHistory.user = user;

        await this.userRepository.save(user);
        //FIXME: Do this check conditionally, basis a configuration parameter i.e if IAM_ALLOW_PREVIOUS_PASSWORDS=false, default true
        await this.userPasswordHistoryRepository.save(userPasswordHistory);

        return {
            status: 'success',
            message: SUCCESS_MESSAGES.FORGOT_PASSWORD_CONFIRMED,
            error: '',
            errorCode: '',
            data: {}
        }
    }

    //FIXME: Do this check conditionally, basis a configuration parameter i.e if IAM_ALLOW_PREVIOUS_PASSWORDS=true, return immediately without processing, i.e false.
    private async isPasswordDuplicate(user: User) {
        const userPwdHistoryEntityArray = await this.userPasswordHistoryRepository.findBy(
            { user: { id: user.id } }
        )
        let userPwdHistoryArray = [];
        // O(n)
        for (const entity of userPwdHistoryEntityArray) {
            userPwdHistoryArray.push(entity.passwordHash);
        }
        // O(n)
        for (const pwdHash of userPwdHistoryArray) {
            const isEqual = await this.hashingService.compare(user.password, pwdHash);
            if (isEqual) {
                return true;
            }
        }
        return false;
    }

    //FIXME: Do this check conditionally, basis a configuration parameter i.e if IAM_ALLOW_PREVIOUS_PASSWORDS=true, return immediately without processing
    private async deleteOldPasswords(user: User) {
        const userPwdHistoryArray = await this.userPasswordHistoryRepository.findBy(
            { user: { id: user.id } }
        )
        const pwdLimit = 2; //FIXME: Should this be moved into the env? IAM_PREVIOUS_PASSWORDS_LIMIT

        // TODO: Check what slice() or splice() does.
        //FIXME - Delete passwords which are older than the latest n passwords. n is configurable
        if (userPwdHistoryArray.length >= pwdLimit) {
            const numToDelete = pwdLimit + 1 - userPwdHistoryArray.length;
            for (let i = 0; i < numToDelete; i++) {
                await this.userPasswordHistoryRepository.remove(userPwdHistoryArray[i]);
            }
        }
    }

    async generateTokens(user: User) {

        const [accessToken, refreshToken] = await Promise.all([
            this.generateAccessToken(user),
            this.generateRefreshToken(user),
        ]);

        return {
            accessToken,
            refreshToken,
        };
    }

    async generateAccessToken(user: User) {

        // const userRoleNames = user.roles.map((role) => role.name).join(';')
        const userRoleNames = user.roles.map((role) => role.name);

        const accessToken = await this.signToken<Partial<ActiveUserData>>(
            user.id,
            this.jwtConfiguration.accessTokenTtl,
            { username: user.username, email: user.email, roles: userRoleNames },
        );

        return accessToken;
    }

    async generateRefreshToken(user: User) {
        const refreshTokenId = randomUUID();

        const refreshToken = await this.signToken(user.id, this.jwtConfiguration.refreshTokenTtl, {
            refreshTokenId,
        })

        // store the refresh token id in the redis storage.
        await this.refreshTokenIdsStorage.insert(user.id, refreshToken);

        return refreshToken;
    }

    async refreshTokens(refreshTokenDto: RefreshTokenDto) {
        try {
            const { sub, refreshTokenId } = await this.jwtService.verifyAsync<Pick<ActiveUserData, 'sub'> & { refreshTokenId: string }>(refreshTokenDto.refreshToken, {
                secret: this.jwtConfiguration.secret,
                audience: this.jwtConfiguration.audience,
                issuer: this.jwtConfiguration.issuer,
            });
            // const user = await this.userRepository.findOneByOrFail({ id: sub });
            const user = await this.userRepository.findOne({
                where: {
                    id: sub,
                },
                relations: {
                    roles: true
                }
            });
            if (!user) {
                throw new UnauthorizedException(ERROR_MESSAGES.SESSION_INVALID);
            }

            // TODO: Replace the if else condition below with a call to validateAndRotate - Done
            // const isValid = await this.refreshTokenIdsStorage.validate(user.id, refreshTokenId);
            // if (isValid) {
            //     // Refresh token rotation.
            //     await this.refreshTokenIdsStorage.invalidate(user.id);
            // } else {
            //     throw new Error('Refresh token is invalid');
            // }

            const currentRefreshToken = await this.refreshTokenIdsStorage.validateAndRotate(user, refreshTokenDto.refreshToken);

            await this.userActivityHistoryService.logEvent('tokenRefreshed', user);

            return {
                accessToken: await this.generateAccessToken(user),
                refreshToken: currentRefreshToken,
            };
        } catch (err) {
            if (err instanceof InvalidatedRefreshTokenError) {
                // Take action: notify user that his refresh token might have been stolen?
                throw new UnauthorizedException(ERROR_MESSAGES.ACCESS_DENIED);
            }

            throw new UnauthorizedException(ERROR_MESSAGES.SESSION_EXPIRED);
        }
    }

    private async signToken<T>(userId: number, expiresIn: number, payload?: T) {
        return await this.jwtService.signAsync(
            {
                sub: userId,
                ...payload,
            },
            {
                audience: this.jwtConfiguration.audience,
                issuer: this.jwtConfiguration.issuer,
                secret: this.jwtConfiguration.secret,
                expiresIn,
            },
        );
    }

    // PROVIDER SPECIFIC CODE
    async validateUserUsingGoogle(user: User) {
        try {
            // Make API call to Google OAuth service to fetch user profile
            const response = await this.httpService.axiosRef.get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${user.googleAccessToken}`);
            const userProfile = response.data;

            // Ensure the fetched profile email & provider Id match the ones we have stored in the database earlier. 
            if (userProfile.email === user.email && userProfile.id === user.googleId) {
                // TODO: remove the access code both from the database.
                return userProfile;
            } else {
                throw new UnauthorizedException(ERROR_MESSAGES.INVALID_USER_PROFILE);
            }
        } catch (error) {
            throw new UnauthorizedException(ERROR_MESSAGES.GOOGLE_OAUTH_PROFILE_FETCH_FAILED);
        }
    }

    async signInUsingGoogle(accessCode: string) {
        const user = await this.userRepository.findOne({
            where: {
                accessCode: accessCode
            },
            relations: {
                roles: true
            }
        });

        // Validate the user against the Google oauth provider. 
        // If the below call finishes without raising an exception then we have validated the user properly.
        await this.validateUserUsingGoogle(user);

        // finally we simply generate the tokens. 
        const tokens = await this.generateTokens(user);
        return {
            user: {
                email: user.email,
                mobile: user.mobile,
                username: user.username,
                // forcePasswordChange: user.forcePasswordChange,
                id: user.id,
                roles: user.roles.map((role, idx, roles) => role.name)
            },
            ...tokens
        }

    }

    private async isPasswordlessRegistrationEnabled() {
        return this.settingService.getConfigValue('passwordlessRegistration');
    }

    //FIXME - Pending implementation
    // async logout() {
    //     // const user = this.request.user; //TODO: // Access the user from the execution context

    //     // Invalidate the refresh token
    //     // await this.refreshTokenIdsStorage.invalidate(user.id);
    // }
    async logout() {
        try {
            const activeUser = this.requestContextService.getActiveUser();
            const userId = activeUser?.sub;
            const user = await this.userRepository.findOne({
                where: {
                    id: userId,
                }
            })
            // Invalidate refresh token if you store them
            await this.refreshTokenIdsStorage.invalidate(userId); // ← Your existing logic

            // Log logout event
            await this.userActivityHistoryService.logEvent('logout', user);


            return { message: SUCCESS_MESSAGES.LOGOUT_SUCCESS};
        } catch (err) {
            throw err instanceof UnauthorizedException || err instanceof InternalServerErrorException
                ? err
                : new InternalServerErrorException(ERROR_MESSAGES.LOGOUT_FAILED);
        }
    }


    async activateUser(userId: number) {
        const user = await this.userService.findOne(userId, {});
        if (!user) {
            throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        user.active = true;
        await this.userRepository.save(user);
    }

    async me(activeUser: ActiveUserData) {
        const user = await this.userRepository.findOne({
            where: {
                id: activeUser.sub,
            },
            relations: {
                roles: true
            }
        });
        const tokens = await this.generateTokens(user);

        const response = {
            user: {
                email: user.email,
                mobile: user.mobile,
                username: user.username,
                // forcePasswordChange: user.forcePasswordChange,
                id: user.id,
                roles: user.roles.map((role, idx, roles) => role.name)
            },
            ...tokens
        }
        return response;
    }

}

function parseUniqueConstraintError(detail: string): string {
    const match = detail.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists\./);
    if (match) {
        const field = match[1];
        const value = match[2];
        const fieldMap: Record<string, string> = {
            username: 'username',
            email: 'email address',
            full_name_user_key: 'full name',
        };
        const friendlyField = fieldMap[field] || field;
        return `A user with ${friendlyField} "${value}" already exists.`;
    }
    return detail;
}

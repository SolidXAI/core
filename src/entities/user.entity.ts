import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, Index, JoinTable, ManyToMany, OneToMany, TableInheritance } from "typeorm";
import { RoleMetadata } from 'src/entities/role-metadata.entity';
import { UserViewMetadata } from 'src/entities/user-view-metadata.entity'
import { UserApiKey } from 'src/entities/user-api-key.entity'
import { Exclude, Expose } from "class-transformer";

@Entity("ss_user")
@TableInheritance({ column: { type: "varchar", name: "type", default: "User" } })
@Exclude()
export class User extends CommonEntity {
    @Index()
    @Column({ type: "varchar", nullable: true })
    @Expose()
    fullName: string;

    @Index({ unique: true })
    @Column({ type: "varchar" })
    @Expose()
    username: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    @Expose()
    email: string;

    @Index()
    @Column({ type: "varchar", nullable: true })
    @Expose()
    mobile: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    password: string;

    @Column({ nullable: true, default: true })
    @Expose()
    forcePasswordChange: boolean = true;

    @Column({ type: "varchar", default: "local" })
    // don't send to client
    lastLoginProvider: string = "local";

    @Column({ type: "varchar", nullable: true })
    // don't send to client (test)
    accessCode: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    googleAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    googleId: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    googleProfilePicture: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    facebookId: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    facebookAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    facebookProfilePicture: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    appleId: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    appleAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    microsoftId: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    microsoftAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    microsoftProfilePicture: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    microsoftActiveDirectoryId: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    microsoftActiveDirectoryAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    microsoftActiveDirectoryProfilePicture: string;

    @Index()
    @Column({ default: true })
    @Expose()
    active: boolean = true;

    @Column({ nullable: true })
    // don't send to client
    forgotPasswordConfirmedAt: Date;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    verificationTokenOnForgotPassword: string;

    @Column({ nullable: true })
    // don't send to client
    verificationTokenOnForgotPasswordExpiresAt: Date;

    @Column({ nullable: true })
    // don't send to client
    emailVerifiedOnRegistrationAt: Date;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    emailVerificationTokenOnRegistration: string;

    @Column({ nullable: true })
    // don't send to client
    emailVerificationTokenOnRegistrationExpiresAt: Date;

    @Column({ nullable: true })
    // don't send to client
    mobileVerifiedOnRegistrationAt: Date;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    mobileVerificationTokenOnRegistration: string;

    @Column({ nullable: true })
    // don't send to client
    mobileVerificationTokenOnRegistrationExpiresAt: Date;

    @Column({ nullable: true })
    // don't send to client
    emailVerifiedOnLoginAt: Date;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    emailVerificationTokenOnLogin: string;

    @Column({ nullable: true })
    // don't send to client
    emailVerificationTokenOnLoginExpiresAt: Date;

    @Column({ nullable: true })
    // don't send to client
    mobileVerifiedOnLoginAt: Date;

    @Column({ type: "varchar", nullable: true })
    // don't send to client
    mobileVerificationTokenOnLogin: string;

    @Column({ nullable: true })
    // don't send to client
    mobileVerificationTokenOnLoginExpiresAt: Date;

    @Column({ type: "varchar", nullable: true })
    @Expose()
    customPayload: string;

    @ManyToMany(() => RoleMetadata, roleMetadata => roleMetadata.users, { cascade: true })
    @JoinTable()
    @Expose()
    roles: RoleMetadata[];

    @OneToMany(() => UserViewMetadata, userViewMetadata => userViewMetadata.user, { cascade: true })
    // don't send to client
    userViewMetadata: UserViewMetadata[];

    // dont send to client
    @Column({ type: "varchar", default: "bcrypt" })
    passwordScheme: string;

    // dont send to client
    @Column({ type: "int", default: 1 })
    passwordSchemeVersion: number;

    // dont send to client
    @Column({ nullable: true })
    rehashedAt: Date;

    @Expose()
    @Column({ type: "int", default: 0 })
    failedLoginAttempts: number = 0;

    @Expose()
    _media: any;

    @Column({ default: false })
    @Expose()
    isAllowedToGenerateApiKeys: boolean = false;

    @OneToMany(() => UserApiKey, key => key.user)
    @Expose()
    apiKeys: UserApiKey[];

}

import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, Index, JoinTable, ManyToMany, OneToMany, TableInheritance } from "typeorm";
import { RoleMetadata } from 'src/entities/role-metadata.entity';
import { UserViewMetadata } from 'src/entities/user-view-metadata.entity'
import { UserApiKey } from 'src/entities/user-api-key.entity'
import { Exclude, Expose } from "class-transformer";

/**
 * Serialization is locked down twice over, and both halves are load-bearing:
 *
 * - The class-level `@Exclude()` below makes User itself an allowlist: only `@Expose()`d
 *   properties are serialized.
 * - Every other property additionally carries its own `@Exclude()`. That looks redundant
 *   here, and for `User` it is - but class-transformer resolves the *class-level* strategy
 *   with a direct lookup on the exact constructor (MetadataStorage.getStrategy), so a
 *   subclass inherits nothing and falls back to `exposeAll`. Since this entity is a
 *   `@TableInheritance` root that consuming projects extend (see
 *   IExtensionUserCreationProvider), an extension user that forgets its own `@Exclude()`
 *   would otherwise serialize the password hash and every OAuth/verification token.
 *   Property-level metadata *is* walked up the prototype chain, so the per-property
 *   decorators are what actually protect subclasses.
 *
 * Keep both. Adding a new column? Give it `@Expose()` or `@Exclude()` - never neither.
 */
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

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    @Expose()
    email: string;

    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    @Expose()
    mobile: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    password: string;

    @Column({ nullable: true, default: true })
    @Expose()
    forcePasswordChange: boolean = true;

    @Column({ type: "varchar", default: "local" })
    @Exclude()
    lastLoginProvider: string = "local";

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    accessCode: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    googleAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    googleId: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    googleProfilePicture: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    facebookId: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    facebookAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    facebookProfilePicture: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    appleId: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    appleAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    microsoftId: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    microsoftAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    microsoftProfilePicture: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    microsoftActiveDirectoryId: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    microsoftActiveDirectoryAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    microsoftActiveDirectoryProfilePicture: string;

    @Index()
    @Column({ default: true })
    @Expose()
    active: boolean = true;

    @Column({ nullable: true })
    @Exclude()
    forgotPasswordConfirmedAt: Date;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    verificationTokenOnForgotPassword: string;

    @Column({ nullable: true })
    @Exclude()
    verificationTokenOnForgotPasswordExpiresAt: Date;

    @Column({ nullable: true })
    @Exclude()
    emailVerifiedOnRegistrationAt: Date;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    emailVerificationTokenOnRegistration: string;

    @Column({ nullable: true })
    @Exclude()
    emailVerificationTokenOnRegistrationExpiresAt: Date;

    @Column({ nullable: true })
    @Exclude()
    mobileVerifiedOnRegistrationAt: Date;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    mobileVerificationTokenOnRegistration: string;

    @Column({ nullable: true })
    @Exclude()
    mobileVerificationTokenOnRegistrationExpiresAt: Date;

    @Column({ nullable: true })
    @Exclude()
    emailVerifiedOnLoginAt: Date;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    emailVerificationTokenOnLogin: string;

    @Column({ nullable: true })
    @Exclude()
    emailVerificationTokenOnLoginExpiresAt: Date;

    @Column({ nullable: true })
    @Exclude()
    mobileVerifiedOnLoginAt: Date;

    @Column({ type: "varchar", nullable: true })
    @Exclude()
    mobileVerificationTokenOnLogin: string;

    @Column({ nullable: true })
    @Exclude()
    mobileVerificationTokenOnLoginExpiresAt: Date;

    @Column({ type: "varchar", nullable: true })
    @Expose()
    customPayload: string;

    @ManyToMany(() => RoleMetadata, roleMetadata => roleMetadata.users, { cascade: true })
    @JoinTable()
    @Expose()
    roles: RoleMetadata[];

    @OneToMany(() => UserViewMetadata, userViewMetadata => userViewMetadata.user, { cascade: true })
    @Exclude()
    userViewMetadata: UserViewMetadata[];

    @Exclude()
    @Column({ type: "varchar", default: "bcrypt" })
    passwordScheme: string;

    @Exclude()
    @Column({ type: "int", default: 1 })
    passwordSchemeVersion: number;

    @Exclude()
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

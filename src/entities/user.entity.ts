import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, Index, JoinTable, ManyToMany, OneToMany, TableInheritance } from "typeorm";
import { RoleMetadata } from 'src/entities/role-metadata.entity';
import { UserViewMetadata } from 'src/entities/user-view-metadata.entity'
import { Exclude, Expose } from "class-transformer";

@Entity("ss_user")
@TableInheritance({ column: { type: "varchar", name: "type", default: "User" } })
@Exclude()
export class User extends CommonEntity {
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
    // don't send to client
    password: string;
    @Column({ type: "boolean", nullable: true, default: true })
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
    @Column({ type: "boolean", default: true })
    @Expose()
    active: boolean = true;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    forgotPasswordConfirmedAt: Date;
    @Column({ type: "varchar", nullable: true })
    // don't send to client
    verificationTokenOnForgotPassword: string;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    verificationTokenOnForgotPasswordExpiresAt: Date;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    emailVerifiedOnRegistrationAt: Date;
    @Column({ type: "varchar", nullable: true })
    // don't send to client
    emailVerificationTokenOnRegistration: string;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    emailVerificationTokenOnRegistrationExpiresAt: Date;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    mobileVerifiedOnRegistrationAt: Date;
    @Column({ type: "varchar", nullable: true })
    // don't send to client
    mobileVerificationTokenOnRegistration: string;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    mobileVerificationTokenOnRegistrationExpiresAt: Date;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    emailVerifiedOnLoginAt: Date;
    @Column({ type: "varchar", nullable: true })
    // don't send to client
    emailVerificationTokenOnLogin: string;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    emailVerificationTokenOnLoginExpiresAt: Date;
    @Column({ type: "timestamp", nullable: true })
    // don't send to client
    mobileVerifiedOnLoginAt: Date;
    @Column({ type: "varchar", nullable: true })
    // don't send to client
    mobileVerificationTokenOnLogin: string;
    @Column({ type: "timestamp", nullable: true })
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
    @Column({ type: "timestamp", nullable: true })
    rehashedAt: Date;
}
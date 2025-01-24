import { CommonEntity } from "src/entities/common.entity"
import { Entity, Column, Index, JoinTable, ManyToMany } from "typeorm";
import { RoleMetadata } from 'src/entities/role-metadata.entity'
@Entity("ss_user")
@Index(["username", "deletedTracker"], { unique: true })
@Index(["email", "deletedTracker"], { unique: true })
@Index(["mobile", "deletedTracker"], { unique: true })

export class User extends CommonEntity {
    @Column({ type: "varchar", nullable: true })
    fullName: string;

    @Index()
    @Column({ type: "varchar", })
    username: string;

    @Index()
    @Column({ type: "varchar",  nullable: true })
    email: string;

    @Index()
    @Column({ type: "varchar",  nullable: true })
    mobile: string;

    @Column({ type: "varchar", nullable: true })
    password: string;

    @Column({ type: "boolean", nullable: true, default: true })
    forcePasswordChange: boolean = true;

    @Column({ type: "varchar", default: "local" })
    lastLoginProvider: string = "local";

    @Column({ type: "varchar", nullable: true })
    accessCode: string;

    @Column({ type: "varchar", nullable: true })
    googleAccessToken: string;

    @Column({ type: "varchar", nullable: true })
    googleId: string;

    @Column({ type: "varchar", nullable: true })
    googleProfilePicture: string;

    @Column({ type: "boolean", default: true })
    active: boolean = true;

    @Column({ type: "timestamp", nullable: true })
    forgotPasswordConfirmedAt: Date;

    @Column({ type: "varchar", nullable: true })
    verificationTokenOnForgotPassword: string;

    @Column({ type: "timestamp", nullable: true })
    verificationTokenOnForgotPasswordExpiresAt: Date;

    @Column({ type: "timestamp", nullable: true })
    emailVerifiedOnRegistrationAt: Date;

    @Column({ type: "varchar", nullable: true })
    emailVerificationTokenOnRegistration: string;

    @Column({ type: "timestamp", nullable: true })
    emailVerificationTokenOnRegistrationExpiresAt: Date;

    @Column({ type: "timestamp", nullable: true })
    mobileVerifiedOnRegistrationAt: Date;

    @Column({ type: "varchar", nullable: true })
    mobileVerificationTokenOnRegistration: string;

    @Column({ type: "timestamp", nullable: true })
    mobileVerificationTokenOnRegistrationExpiresAt: Date;

    @Column({ type: "timestamp", nullable: true })
    emailVerifiedOnLoginAt: Date;

    @Column({ type: "varchar", nullable: true })
    emailVerificationTokenOnLogin: string;

    @Column({ type: "timestamp", nullable: true })
    emailVerificationTokenOnLoginExpiresAt: Date;

    @Column({ type: "timestamp", nullable: true })
    mobileVerifiedOnLoginAt: Date;

    @Column({ type: "varchar", nullable: true })
    mobileVerificationTokenOnLogin: string;

    @Column({ type: "timestamp", nullable: true })
    mobileVerificationTokenOnLoginExpiresAt: Date;

    @Column({ type: "varchar", nullable: true })
    customPayload: string;

    @ManyToMany(() => RoleMetadata, roleMetadata => roleMetadata.users, { cascade: true })
    @JoinTable()
    roles: RoleMetadata[];
}
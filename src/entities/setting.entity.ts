import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index} from 'typeorm'

@Entity("ss_setting")
export class Setting extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    keys: string;
    @Column({ type: "varchar", nullable: true })
    values: string;
    @Column({ type: "varchar", nullable: true })
    authPagesLayout: string;
    @Column({ type: "varchar", nullable: true })
    authPagesTheme: string;
    @Column({ type: "varchar", nullable: true })
    appTitle: string;
    @Column({ type: "varchar", nullable: true })
    appDescription: string;
    @Column({ type: "varchar", nullable: true })
    appTnc: string;
    @Column({ type: "varchar", nullable: true })
    appPrivacyPolicy: string;
    @Column({ type: "boolean", nullable: true, default: false })
    iamAllowPublicRegistration: boolean = false;
    @Column({ type: "boolean", nullable: true, default: false })
    iamPasswordRegistrationEnabled: boolean = false;
    @Column({ type: "boolean", nullable: true, default: false })
    iamPasswordLessRegistrationEnabled: boolean = false;
    @Column({ type: "boolean", nullable: true, default: false })
    iamActivateUserOnRegistration: boolean = false;
    @Column({ type: "varchar", nullable: true })
    iamDefaultRole: string;
    @Column({ type: "boolean", nullable: true, default: false })
    iamGoogleOAuthEnabled: boolean = false;
    @Column({ type: "boolean", nullable: true, default: false })
    shouldQueueEmails: boolean = false;
    @Column({ type: "boolean", nullable: true, default: false })
    shouldQueueSms: boolean = false;
}
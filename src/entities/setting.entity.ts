import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column} from 'typeorm'
@Entity("ss_setting")
export class Setting extends CommonEntity{
@Column({ type: "varchar", nullable: true })
authPagesLayout: string;

@Column({ type: "varchar", nullable: true })
authPagesTheme: string;

@Column({ type: "varchar", nullable: true })
appTitle: string;

@Column({ type: "varchar", nullable: true })
appLogo: string;

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

@Column({ name: "iam_google_oauth", type: "boolean", nullable: true, default: false })
iamGoogleOAuth: boolean = false;
}
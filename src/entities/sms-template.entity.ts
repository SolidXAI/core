import { CommonEntity } from 'src/entities/common.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity("ss_sms_template")
export class SmsTemplate extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "name", type: "varchar"})
    name: string;
    @Column({ name: "display_name", type: "varchar" })
    displayName: string;
    @Column({ name: "body", type: "varchar", nullable: true })
    body: string;
    @Column({ type: "varchar", nullable: true })
    smsProviderTemplateId: string;
    @Column({ name: "description", type: "text", nullable: true })
    description: string;
    @Column({ name: "active", nullable: true, default: true })
    active: boolean = true;
    @Column({ name: "type", type: "varchar", nullable: true })
    type: string;
}
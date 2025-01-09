import { CommonEntity } from 'src/entities/common.entity';
import { Column, Entity } from 'typeorm';


@Entity("ss_sms_template")
export class SmsTemplate extends CommonEntity {
    @Column({ unique: true })
    name: string;

    @Column()
    displayName: string;

    @Column({ type: 'text', nullable: true })
    body: string;

    @Column({ nullable: true })
    smsProviderTemplateId: string;

    @Column({ nullable: true })
    description: string;

    @Column({ default: false })
    active: boolean;
}
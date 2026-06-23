import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

import { CommonEntity } from "./common.entity";
import { User } from "./user.entity";

@Entity("ss_user_device_metadata")
@Index("ss_user_device_metadata_user_device", ["user", "deviceId"], {
  unique: true,
})
@Index("ss_user_device_metadata_push_provider_recipient_id", [
  "pushProviderRecipientId",
])
@Index("ss_user_device_metadata_user_active", ["user", "isActive"])
export class UserDeviceMetadata extends CommonEntity {
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn()
  user: User;

  @Column({ name: "device_id" })
  deviceId: string;

  @Column({ nullable: true })
  pushDeviceToken?: string;

  @Column({ name: "push_provider_recipient_id", nullable: true })
  pushProviderRecipientId?: string;

  @Column({ default: "unknown" })
  platform: string;

  @Column({ nullable: true })
  osName?: string;

  @Column({ nullable: true })
  osVersion?: string;

  @Column({ nullable: true })
  appVersion?: string;

  @Column({ nullable: true })
  deviceName?: string;

  @Column({ nullable: true })
  deviceType?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ default: true })
  isTrusted: boolean;

  @Column({ type: "timestamp", nullable: true })
  pushTokenUpdatedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  lastActiveAt?: Date;
}

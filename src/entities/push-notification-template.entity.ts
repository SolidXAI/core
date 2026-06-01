import { Column, Entity, Index } from "typeorm";
import { CommonEntity } from "src/entities/common.entity";
import { getColumnType } from "src/helpers/typeorm-db-helper";

@Entity("ss_push_template")
export class PushNotificationTemplate extends CommonEntity {
  @Index({ unique: true })
  @Column({ name: "name", type: "varchar" })
  name: string;

  @Column({ name: "display_name", type: "varchar" })
  displayName: string;

  @Column({ name: "title", type: "varchar", default: "" })
  title: string;

  @Column({ name: "body", ...getColumnType("longText"), default: "" })
  body: string;

  @Column({ name: "data_template", type: "simple-json", nullable: true })
  dataTemplate?: Record<string, string>;

  @Column({ name: "description", nullable: true })
  description?: string;

  @Column({ name: "active", nullable: true, default: true })
  active: boolean = true;

  @Column({ name: "type", type: "varchar", nullable: true })
  type?: string;
}

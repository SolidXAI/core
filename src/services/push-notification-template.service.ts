import { Injectable } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { CRUDService } from "./crud.service";
import { PushNotificationTemplate } from "src/entities/push-notification-template.entity";
import { PushNotificationTemplateRepository } from "src/repository/push-notification-template.repository";
import { MediaStorageProviderMetadataService } from "./media-storage-provider-metadata.service";
import { MediaService } from "./media.service";
import { CreatePushNotificationTemplateDto } from "src/dtos/create-push-notification-template.dto";

@Injectable()
export class PushNotificationTemplateService extends CRUDService<PushNotificationTemplate> {
  constructor(
    readonly mediaStorageProviderService: MediaStorageProviderMetadataService,
    readonly mediaService: MediaService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: PushNotificationTemplateRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(
      entityManager,
      repo,
      "pushNotificationTemplate",
      "app-builder",
      moduleRef,
    );
  }

  async findOneByName(name: string): Promise<PushNotificationTemplate | null> {
    return this.repo.findOne({
      where: { name },
    });
  }

  async removeByName(name: string): Promise<void> {
    const existing = await this.findOneByName(name);
    if (existing) {
      await this.repo.remove(existing);
    }
  }

  // Seeder-safe create path that does not require app-builder model metadata.
  async createFromSeed(
    dto: CreatePushNotificationTemplateDto,
  ): Promise<PushNotificationTemplate> {
    return this.repo.save(this.repo.create(dto as PushNotificationTemplate));
  }
}

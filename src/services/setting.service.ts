import { Inject, Injectable } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService, ConfigType } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import commonConfig from 'src/config/common.config';
import { iamConfig } from 'src/config/iam.config';
import { Setting } from '../entities/setting.entity';

@Injectable()
export class SettingService extends CRUDService<Setting> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @Inject(iamConfig.KEY) private readonly iamConfiguration: ConfigType<typeof iamConfig>,
    @Inject(commonConfig.KEY)
    private readonly commonConfiguration: ConfigType<typeof commonConfig>,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(Setting, 'default')
    readonly repo: Repository<Setting>,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'setting', 'solid-core', moduleRef
    );
  }

  async wrapSettings(): Promise<Record<string, any>> {
    const settingsArray: any[] = await this.repo.find();

    if (!settingsArray || settingsArray.length === 0) {
      return this.getDefaultSettings();
    }

    const settings = settingsArray[0];

    const defaultSettings = this.getDefaultSettings();

    const mergedSettings = Object.keys(defaultSettings).reduce((acc, key) => {
      acc[key] = settings[key] !== null && settings[key] !== undefined ? settings[key] : defaultSettings[key];
      return acc;
    }, {} as Record<string, any>);

    return mergedSettings;
  }

  private getDefaultSettings(): Record<string, any> {
    return {
      iamAllowPublicRegistration: this.iamConfiguration.allowPublicRegistration,
      iamPasswordRegistrationEnabled: false,
      iamPasswordLessRegistrationEnabled: this.iamConfiguration.passwordlessRegistration,
      iamActivateUserOnRegistration: this.iamConfiguration.activateUserOnRegistration,
      iamGoogleOAuthEnabled: false,
      authPagesLayout: "center",
      authPagesTheme: "light",
      appTitle: process.env.SOLID_APP_NAME || "Solid App",
      appLogo: "",
      appDescription: "",
      appTnc: "",
      appPrivacyPolicy: "",
      iamDefaultRole: this.iamConfiguration.defaultRole,
      shouldQueueEmails: this.commonConfiguration.shouldQueueEmails,
      shouldQueueSms: this.commonConfiguration.shouldQueueSms
    };
  }

}

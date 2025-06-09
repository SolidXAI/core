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

  async seedDefaultSettings(): Promise<void> {
    const settingsSeederData = {
      allowPublicRegistration: this.iamConfiguration.allowPublicRegistration,
      iamPasswordRegistrationEnabled: this.iamConfiguration.iamPasswordRegistrationEnabled,
      passwordlessRegistration: this.iamConfiguration.passwordlessRegistration,
      activateUserOnRegistration: this.iamConfiguration.activateUserOnRegistration,
      iamGoogleOAuthEnabled: false,
      authPagesLayout: "center",
      authPagesTheme: "light",
      appLogo: "",
      companylogo: "",
      favicon: "",
      appLogoPosition: "in_form_view",
      showAuthContent: false,
      appTitle: process.env.SOLID_APP_NAME || "Solid App",
      appSubtitle: process.env.SOLID_APP_SUBTITLE || "Lorem Ipsum",
      appDescription: process.env.SOLID_APP_DESCRIPTION || "lorem ipsum",
      showLegalLinks: false,
      appTnc: "",
      appPrivacyPolicy: "",
      defaultRole: this.iamConfiguration.defaultRole,
      shouldQueueEmails: this.commonConfiguration.shouldQueueEmails,
      shouldQueueSms: this.commonConfiguration.shouldQueueSms,
      enableDarkMode: true,
      copyright : ""
    };

    const existingSettings = await this.repo.find();
    const existingKeys = new Set(existingSettings.map(s => s.key));

    const settingsToInsert: Setting[] = [];
    for (const [key, value] of Object.entries(settingsSeederData)) {
      if (!existingKeys.has(key)) {
        const setting = new Setting();
        setting.key = key;
        setting.value = typeof value === 'boolean' ? value.toString() :
          Array.isArray(value) ? value.join(',') :
            value === null || value === undefined ? '' : String(value);
        settingsToInsert.push(setting);
      }
    }

    if (settingsToInsert.length > 0) {
      await this.repo.save(settingsToInsert);
    }
  }

  async wrapSettings(): Promise<Record<string, any>> {
    const settingsArray: Setting[] = await this.repo.find();

    if (!settingsArray || settingsArray.length === 0) {
      return this.getDefaultSettings();
    }

    const settingsMap: Record<string, any> = {};
    for (const setting of settingsArray) {
      if (setting.key && setting.value !== undefined && setting.value !== null) {
        let value = setting.value;

        if (value === 'true' || value === 'false') {
          settingsMap[setting.key] = value === 'true';
        }
        else if (!isNaN(Number(value)) && value.trim() !== '') {
          settingsMap[setting.key] = Number(value);
        }
        else if (value.includes(',')) {
          settingsMap[setting.key] = value.split(',').map(item => item.trim());
        }
        else {
          settingsMap[setting.key] = value;
        }
      }
    }

    const defaultSettings = this.getDefaultSettings();

    const mergedSettings = Object.keys(defaultSettings).reduce((acc, key) => {
      acc[key] = settingsMap[key] !== undefined ? settingsMap[key] : defaultSettings[key];
      return acc;
    }, {} as Record<string, any>);

    return mergedSettings;
  }

  private getDefaultSettings(): Record<string, any> {
    return {
      allowPublicRegistration: this.iamConfiguration.allowPublicRegistration,
      iamPasswordRegistrationEnabled: this.iamConfiguration.iamPasswordRegistrationEnabled,
      passwordlessRegistration: this.iamConfiguration.passwordlessRegistration,
      activateUserOnRegistration: this.iamConfiguration.activateUserOnRegistration,
      iamGoogleOAuthEnabled: false,
      authPagesLayout: "center",
      authPagesTheme: "light",
      appLogo: "",
      companylogo: "",
      favicon: "",
      appLogoPosition: "in_form_view", //in_form_view | in_image_view
      showAuthContent: false,
      appTitle: process.env.SOLID_APP_NAME || "Solid App",
      appSubtitle: "",
      appDescription: "",
      showLegalLinks: false,
      appTnc: "",
      appPrivacyPolicy: "",
      defaultRole: this.iamConfiguration.defaultRole,
      shouldQueueEmails: this.commonConfiguration.shouldQueueEmails,
      shouldQueueSms: this.commonConfiguration.shouldQueueSms,
      enableDarkMode: true,
      copyright : ""
    };
  }

  async getConfigValue(settingKey: string) {
    try {
      const settingsArray: Setting[] = await this.repo.find();
      const settingEntry = settingsArray.find(setting => setting.key === settingKey);

      if (settingEntry && settingEntry.value !== null && settingEntry.value !== undefined) {
        const value = settingEntry.value;

        if (value === 'true' || value === 'false') {
          return value === 'true';
        }
        else if (!isNaN(Number(value)) && value.trim() !== '') {
          return Number(value);
        }
        else if (value.includes(',')) {
          return value.split(',').map(item => item.trim());
        }
        else {
          return value;
        }
      }

      const defaultSettings = this.getDefaultSettings();
      return defaultSettings[settingKey];
    } catch (error) {
      const defaultSettings = this.getDefaultSettings();
      return defaultSettings[settingKey];
    }
  }

  async updateSettings(settings: Record<string, any> = {}, files: Array<Express.Multer.File> = []): Promise<Setting[]> {
    const existingSettings = await this.repo.find();
    const existingKeys = new Set(existingSettings.map(s => s.key));

    const settingsToUpdate: Setting[] = [];
    const settingsToCreate: Setting[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const key = file.fieldname;
        const fileStoragePath = `${this.configService.get('app-builder.fileStorageDir')}/${file.filename}-${file.originalname}`;
        
        await this.fileService.copyFile(file.path, fileStoragePath);
        await this.fileService.deleteFile(file.path);

        if (existingKeys.has(key)) {
          const existingSetting = existingSettings.find(s => s.key === key);
          if (existingSetting) {
            existingSetting.value = fileStoragePath;
            settingsToUpdate.push(existingSetting);
          }
        } else {
          const newSetting = new Setting();
          newSetting.key = key;
          newSetting.value = fileStoragePath;
          settingsToCreate.push(newSetting);
        }
      }
    }

    for (const [key, value] of Object.entries(settings)) {
      if (files && files.some(f => f.fieldname === key)) {
        continue;
      }

      const stringValue = typeof value === 'boolean' ? value.toString() :
        Array.isArray(value) ? value.join(',') :
          value === null || value === undefined ? '' : String(value);

      if (existingKeys.has(key)) {
        const existingSetting = existingSettings.find(s => s.key === key);
        if (existingSetting) {
          existingSetting.value = stringValue;
          settingsToUpdate.push(existingSetting);
        }
      } else {
        const newSetting = new Setting();
        newSetting.key = key;
        newSetting.value = stringValue;
        settingsToCreate.push(newSetting);
      }
    }

    if (settingsToUpdate.length > 0) {
      await this.repo.save(settingsToUpdate);
    }

    if (settingsToCreate.length > 0) {
      await this.repo.save(settingsToCreate);
    }

    return [...settingsToUpdate, ...settingsToCreate];
  }

  async getAllSettings(): Promise<Record<string, any>> {
    const settingsArray = await this.repo.find();
    const settingsMap: Record<string, any> = {};

    for (const setting of settingsArray) {
      if (setting.key && setting.value !== undefined && setting.value !== null) {
        const value = setting.value;

        if (value === 'true' || value === 'false') {
          settingsMap[setting.key] = value === 'true';
        }
        else if (!isNaN(Number(value)) && value.trim() !== '') {
          settingsMap[setting.key] = Number(value);
        }
        else if (value.includes(',')) {
          settingsMap[setting.key] = value.split(',').map(item => item.trim());
        }
        else {
          settingsMap[setting.key] = value;
        }
      }
    }

    return settingsMap;
  }
}

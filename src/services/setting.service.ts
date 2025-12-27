import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService, ConfigType } from '@nestjs/config';
import commonConfig from 'src/config/common.config';
import { iamConfig } from 'src/config/iam.config';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { CreateSettingDto } from 'src/dtos/create-setting.dto';
import { GetMcpUrlDto } from 'src/dtos/get-mcp-url.dto';
import { User } from 'src/entities/user.entity';
import { SettingRepository } from 'src/repository/setting.repository';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { Setting } from '../entities/setting.entity';
import { RequestContextService } from './request-context.service';

@Injectable()
export class SettingService extends CRUDService<Setting> {
  constructor(
    @Inject(forwardRef(() => ModelMetadataService))
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
    // @InjectRepository(Setting, 'default')
    // readonly repo: Repository<Setting>,
    readonly repo: SettingRepository,
    readonly moduleRef: ModuleRef,
    private readonly requestContextService: RequestContextService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'setting', 'solid-core', moduleRef
    );
  }

  async seedDefaultSettings(): Promise<void> {
    const settingsSeederData = {
      passwordlessRegistrationValidateWhat: this.iamConfiguration.passwordlessRegistrationValidateWhat,
      allowPublicRegistration: this.iamConfiguration.allowPublicRegistration,
      passwordBasedAuth: this.iamConfiguration.passwordBasedAuth,
      passwordLessAuth: this.iamConfiguration.passwordLessAuth,
      activateUserOnRegistration: this.iamConfiguration.activateUserOnRegistration,
      iamGoogleOAuthEnabled: false,
      authPagesLayout: "center",
      authPagesTheme: "light",
      appLogo: null,
      companylogo: null,
      favicon: null,
      appLogoPosition: "in_form_view",
      showAuthContent: false,
      appTitle: process.env.SOLID_APP_NAME || "Solid App",
      appSubtitle: process.env.SOLID_APP_SUBTITLE || "Lorem Ipsum",
      appDescription: process.env.SOLID_APP_DESCRIPTION || "lorem ipsum",
      showLegalLinks: false,
      appTnc: null,
      appPrivacyPolicy: null,
      defaultRole: this.iamConfiguration.defaultRole,
      shouldQueueEmails: this.commonConfiguration.shouldQueueEmails,
      shouldQueueSms: this.commonConfiguration.shouldQueueSms,
      enableDarkMode: true,
      copyright: null,
      enableUsername: true,
      enabledNotification: true,
      contactSupportEmail: null,
      contactSupportDisplayName: null,
      contactSupportIcon: null,
      authScreenRightBackgroundImage: null,
      authScreenLeftBackgroundImage: null,
      authScreenCenterBackgroundImage: null,
      authenticationPasswordRegex: this.iamConfiguration.PASSWORD_REGEX,
      authenticationPasswordRegexErrorMessage: this.iamConfiguration.PASSWORD_REGEX_ERROR_MESSAGE,
      authenticationPasswordComplexityDescription: this.iamConfiguration.PASSWORD_COMPLEXITY_DESC,
      solidXGenAiCodeBuilderConfig: JSON.stringify({
        defaultProvider: "",
        availableProviders: []
      }),
      showNameFieldsForRegistration: this.iamConfiguration.showNameFieldsForRegistration,
      forceChangePasswordOnFirstLogin: this.iamConfiguration.forceChangePasswordOnFirstLogin
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
            value === null || value === undefined ? null : String(value);
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
    const arrayKeysToSkip = [
      'authenticationPasswordRegex',
      'authenticationPasswordRegexErrorMessage',
      'authenticationPasswordComplexityDescription',
    ];
    for (const setting of settingsArray) {
      if (setting.key && setting.value !== undefined && setting.value !== null) {
        let value = setting.value;
        try {
          settingsMap[setting.key] = JSON.parse(value);
        } catch {
          if (value === 'true' || value === 'false') {
            settingsMap[setting.key] = value === 'true';
          } else if (!isNaN(Number(value)) && value.trim() !== '') {
            settingsMap[setting.key] = Number(value);
          } else if (!arrayKeysToSkip.includes(setting.key) && value.includes(',')) {
            settingsMap[setting.key] = value.split(',').map(item => item.trim());
          } else {
            settingsMap[setting.key] = value;
          }
        }

        // if (value === 'true' || value === 'false') {
        //   settingsMap[setting.key] = value === 'true';
        // }
        // else if (!isNaN(Number(value)) && value.trim() !== '') {
        //   settingsMap[setting.key] = Number(value);
        // }
        // else if (value.includes(',')) {
        //   settingsMap[setting.key] = value.split(',').map(item => item.trim());
        // }
        // else {
        //   settingsMap[setting.key] = value;
        // }
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
      passwordlessRegistrationValidateWhat: this.iamConfiguration.passwordlessRegistrationValidateWhat,
      allowPublicRegistration: this.iamConfiguration.allowPublicRegistration,
      passwordBasedAuth: this.iamConfiguration.passwordBasedAuth,
      passwordLessAuth: this.iamConfiguration.passwordLessAuth,
      activateUserOnRegistration: this.iamConfiguration.activateUserOnRegistration,
      iamGoogleOAuthEnabled: false,
      authPagesLayout: "center",
      authPagesTheme: "light",
      appLogo: null,
      companylogo: null,
      favicon: null,
      appLogoPosition: "in_form_view", //in_form_view | in_image_view
      showAuthContent: false,
      appTitle: process.env.SOLID_APP_NAME || "Solid App",
      appSubtitle: null,
      appDescription: null,
      showLegalLinks: false,
      appTnc: null,
      appPrivacyPolicy: null,
      defaultRole: this.iamConfiguration.defaultRole,
      shouldQueueEmails: this.commonConfiguration.shouldQueueEmails,
      shouldQueueSms: this.commonConfiguration.shouldQueueSms,
      enableDarkMode: true,
      copyright: null,
      forceChangePasswordOnFirstLogin: this.iamConfiguration.forceChangePasswordOnFirstLogin,
      enableUsername: true,
      enabledNotification: true,
      contactSupportEmail: null,
      contactSupportDisplayName: null,
      contactSupportIcon: null,
      authScreenRightBackgroundImage: null,
      authScreenLeftBackgroundImage: null,
      authScreenCenterBackgroundImage: null,
      authenticationPasswordRegex: this.iamConfiguration.PASSWORD_REGEX,
      authenticationPasswordRegexErrorMessage: this.iamConfiguration.PASSWORD_REGEX_ERROR_MESSAGE,
      authenticationPasswordComplexityDescription: this.iamConfiguration.PASSWORD_COMPLEXITY_DESC,
      solidXGenAiCodeBuilderConfig: JSON.stringify({
        defaultProvider: "",
        availableProviders: []
      }),
      iamAutoGeneratedPassword: this.iamConfiguration.iamAutoGeneratedPassword,
      showNameFieldsForRegistration: this.iamConfiguration.showNameFieldsForRegistration
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

  async updateSettings(
    settings: CreateSettingDto[] = [],
    uploadedFiles: Array<Express.Multer.File> = []
  ): Promise<Setting[]> {
    const activeUser = this.requestContextService.getActiveUser();
    const userId = activeUser?.sub;

    const existingSettings = await this.repo.find();

    const settingsToUpdate: Setting[] = [];
    const settingsToCreate: Setting[] = [];

    let user: User | null = null;
    const hasUserSettings = settings.some(dto => dto.type === 'user');
    if (hasUserSettings && userId) {
      user = await this.userRepository.findOne({ where: { id: userId } });
    }

    // Handle uploaded files
    if (uploadedFiles?.length) {
      for (const file of uploadedFiles) {
        const settingKey = file.fieldname;
        const relativeFileName = `${file.filename}-${file.originalname}`;
        const storagePath = `${this.configService.get('app-builder.fileStorageDir')}/${relativeFileName}`;
        const baseUrl = process.env.BASE_URL || '';
        const fileUrl = `${baseUrl}/${storagePath}`;

        await this.fileService.copyFile(file.path, storagePath);
        await this.fileService.deleteFile(file.path);

        const matchedDto = settings.find(dto => dto.key === settingKey);
        const settingType = matchedDto?.type ?? 'system';

        const existingSetting = existingSettings.find(s => s.key === settingKey);
        if (existingSetting) {
          existingSetting.value = fileUrl;
          existingSetting.type = settingType;
          settingsToUpdate.push(existingSetting);
        } else {
          const newSetting = new Setting();
          newSetting.key = settingKey;
          newSetting.value = fileUrl;
          newSetting.type = settingType;

          if (settingType === 'user' && user) {
            newSetting.user = user;
          }

          settingsToCreate.push(newSetting);
        }
      }
    }

    // Handle non-file settings
    for (const settingDto of settings) {
      if (uploadedFiles?.some(file => file.fieldname === settingDto.key)) {
        continue; // skip if already handled via file
      }

      const key = settingDto.key;
      // const value = settingDto.value ?? '';
      const rawValue = settingDto.value;
      const value = rawValue === null || rawValue === undefined ? null : String(rawValue);

      const settingType = settingDto.type ?? 'system';

      const existingSetting = existingSettings.find(s => s.key === key);
      if (existingSetting) {
        existingSetting.value = value;
        existingSetting.type = settingType;
        settingsToUpdate.push(existingSetting);
      } else {
        const newSetting = new Setting();
        newSetting.key = key;
        newSetting.value = value;
        newSetting.type = settingType;

        if (settingType === 'user' && user) {
          newSetting.user = user;
        }

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

  async getAllSettings(): Promise<{ system: Record<string, any>, user: Record<string, any> }> {
    const settingsArray = await this.repo.find({ relations: ['user'] });

    const system: Record<string, any> = {};
    const user: Record<string, any> = {};
    const arrayKeysToSkip = [
      'authenticationPasswordRegex',
      'authenticationPasswordRegexErrorMessage',
      'authenticationPasswordComplexityDescription',
    ];
    for (const setting of settingsArray) {
      if (setting.key && setting.value !== undefined && setting.value !== null) {
        const value = setting.value;
        let parsedValue: any;

        try {
          parsedValue = JSON.parse(value);
        } catch {
          if (value === 'true' || value === 'false') {
            parsedValue = value === 'true';
          } else if (!isNaN(Number(value)) && value.trim() !== '') {
            parsedValue = Number(value);
          } else if (!arrayKeysToSkip.includes(setting.key) && value.includes(',')) {
            parsedValue = value.split(',').map(item => item.trim());
          } else {
            parsedValue = value;
          }
        }
        if (setting.type === 'user') {
          user[setting.key] = parsedValue;
        } else {
          system[setting.key] = parsedValue;
        }
      }
    }

    return { system, user };
  }

  async getMcpUrl(getMcpUrlDto: GetMcpUrlDto, solidRequestContext: any = {}): Promise<any> {

    const { showHeader, inListView } = getMcpUrlDto;

    if (solidRequestContext.activeUser) {
      const permissionNames = ["SettingController.getMcpUrl"];
      const matchingPermssions = solidRequestContext.activeUser.permissions.filter((p: any) => permissionNames.includes(p));
      const hasPermission = matchingPermssions.length > 0;
      if (!hasPermission) {
        throw new BadRequestException(ERROR_MESSAGES.FORBIDDEN);
      }
    }
    const apiKey = process.env.MCP_API_KEY;
    const userId = solidRequestContext.activeUser.sub;
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    return { mcpUrl: `${mcpServerUrl}/static/frontend.html?solidx-mcp-api-key=${apiKey}&solidx-user-id=${userId}&solidx-show-header=${showHeader}&solidx-in-list-view=${inListView}` };
  }

}

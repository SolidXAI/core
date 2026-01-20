import { BadRequestException, ForbiddenException, Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { CreateSettingDto } from 'src/dtos/create-setting.dto';
import { GetMcpUrlDto } from 'src/dtos/get-mcp-url.dto';
import { User } from 'src/entities/user.entity';
import { SettingRepository } from 'src/repository/setting.repository';
import { FileService } from 'src/services/file.service';
import { Setting } from '../entities/setting.entity';
import { RequestContextService } from './request-context.service';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ISettingsProvider, SettingDefinition } from 'src/interfaces';


@Injectable()
export class SettingService {
  private settings: SettingDefinition[] = [];

  constructor(
    readonly fileService: FileService,
    readonly solidRegistry: SolidRegistry,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    readonly repo: SettingRepository,
    private readonly requestContextService: RequestContextService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    // super(entityManager, repo, 'setting', 'solid-core', moduleRef);
  }

  // async onApplicationBootstrap() {
  //   const settingsFromDb = await this.getSettingsFromDb();
  //   const settingsFromProvider = this.getAllSettingsFromProviders();
  // }

  private readonly SYSTEM_SETTINGS_CACHE_KEY = 'cached-system-settings';

  async getSettingsFromDb(): Promise<Setting[]> {
    // const cachedSettings = await this.cacheManager.get<Setting[]>(
    //   this.SYSTEM_SETTINGS_CACHE_KEY,
    // );
    // if (cachedSettings) {
    //   return cachedSettings;
    // }

    const settings = await this.repo.find({ relations: ['user'] });
    // TTL in seconds
    // await this.cacheManager.set(this.SYSTEM_SETTINGS_CACHE_KEY, settings, 60 * 5);
    return settings;
  }

  async mergeDbSettingsIntoProviderSettings(dbSettings: Setting[], providerSettings: SettingDefinition[]): Promise<SettingDefinition[]> {
    // TODO: deep copy of providerSettings array such that each providerSetting.value is set to the corresponding dbSetting.value as long as key & namespace matches.
    return [];
  }

  /**
   * This method will seed (insert only) settings that are introduced in code but do not already exist in the database. 
   * Also this method only deals with settings with level system-admin-editable & internal-user.
   */
  async seedDefaultSettings(): Promise<void> {
    // Seed only settings with level system-admin-editable & internal-user
    const settingsSeederData = this.getAllSettingsFromProviders().filter(i => i.level !== "system-env" && i.level !== "system-admin-readonly");

    // Get hold of the current values from the database.
    const existingSettings: Setting[] = await this.getSettingsFromDb();

    const existingKeys = new Set(existingSettings.map(s => s.key));
    const settingsToInsert: Setting[] = [];
    // for (const [key, value] of Object.entries(settingsSeederData)) {
    //   if (!existingKeys.has(key)) {
    //     const setting = new Setting();
    //     setting.key = key;
    //     setting.value = typeof value === 'boolean' ? value.toString() :
    //       Array.isArray(value) ? value.join(',') :
    //         value === null || value === undefined ? null : String(value);
    //     settingsToInsert.push(setting);
    //   }
    // }

    for (const { key, value } of settingsSeederData) {
      if (!existingKeys.has(key)) {
        const setting = new Setting();
        setting.key = key;

        setting.value =
          typeof value === 'boolean'
            ? value.toString()
            : Array.isArray(value)
              ? value.join(',')
              : value === null || value === undefined
                ? null
                : String(value);

        settingsToInsert.push(setting);
      }
    }

    if (settingsToInsert.length > 0) {
      await this.repo.save(settingsToInsert);
    }
  }

  /**
   * Reads all registered providers and gathers settings from across the running platform.
   * This is the superset of all possible settings. 
   * @returns 
   */
  private getAllSettingsFromProviders(): Array<any> {
    // get all settings from registry 
    const allSettingsProviders = this.solidRegistry.getSettingsProviders();
    const settings: SettingDefinition[] = [];
    for (const wrapper of allSettingsProviders) {
      const instance = wrapper.instance as ISettingsProvider;
      // if (!instance?.getSettings) continue;
      settings.push(...instance.getSettings());
    }

    return settings
  }

  /**
   * This method updates settings from the admin user interface. 
   * Most likely settings with level system-admin-editable & internal-user are the ones that will get modified here. 
   * 
   * @param settings 
   * @param uploadedFiles 
   * @returns 
   */
  async updateSettings(settings: CreateSettingDto[] = [], uploadedFiles: Array<Express.Multer.File> = []): Promise<Setting[]> {
    const activeUser = this.requestContextService.getActiveUser();
    const userId = activeUser?.sub;

    // const existingSettings = await this.repo.find();
    const existingSettings: Setting[] = await this.getSettingsFromDb();


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
        const fileStorageDir = await this.getConfigValue("app-builder", "fileStorageDir")
        const storagePath = `${fileStorageDir}/${relativeFileName}`;
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
    await this.cacheManager.del(this.SYSTEM_SETTINGS_CACHE_KEY);

    return [...settingsToUpdate, ...settingsToCreate];
  }

  async getConfigValue(namespace: String, settingKey: string) {
    try {
      const settingsArray: Setting[] = await this.getSettingsFromDb();

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

      const getAllSettings = this.getAllSettingsFromProviders();
      const settingValue = getAllSettings.find(i => (i.key == settingKey && i.namespace == namespace))
      if (settingValue) {
        return settingValue.value;
      }
    } catch (error) {

      // in case somethings wrong with repo call 
      const getAllSettings = this.getAllSettingsFromProviders();
      const settingValue = getAllSettings.find(i => (i.key == settingKey && i.namespace == namespace))
      if (settingValue) {
        return settingValue.value;
      }
    }
  }

  /**
   * Method used from the solid-core-ui to fetch available settings. 
   * Here we are returning settings other than system-env.
   * 
   * @returns 
   */
  async getNonSystemSettings(): Promise<Record<any, any>> {
    // TODO remove system level from settings array
    const settingsArray: Setting[] = await this.getSettingsFromDb();
    const nonSystemEnvSettings = this.getAllSettingsFromProviders().filter(i => i.level !== "system-env");

    // TODO: merge based on what is there in the DB and what is there in our providers...

    const finalSettings = {}
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
        finalSettings[setting.key] = parsedValue
      }
    }

    return finalSettings;
  }

  async getMcpUrl(getMcpUrlDto: GetMcpUrlDto, solidRequestContext: any = {}): Promise<any> {

    const { showHeader, inListView } = getMcpUrlDto;

    if (process.env.MCP_ENABLED === 'false') {
      throw new ForbiddenException(ERROR_MESSAGES.FORBIDDEN);
    }

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

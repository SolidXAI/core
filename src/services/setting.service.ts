import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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
import { ISettingsProvider, NoInfer, SettingDefinition, SettingLevel } from 'src/interfaces';
import { ModuleMetadataRepository } from 'src/repository/module-metadata.repository';
import type { SolidCoreSetting } from './settings/default-settings-provider.service';

@Injectable()
export class SettingService {
  private settings: SettingDefinition[] = [];

  private readonly arrayKeysToSkip = new Set([
    'authenticationPasswordRegex',
    'authenticationPasswordRegexErrorMessage',
    'authenticationPasswordComplexityDescription',
  ]);

  constructor(
    readonly fileService: FileService,
    readonly solidRegistry: SolidRegistry,
    readonly repo: SettingRepository,
    readonly moduleMetadataRepo: ModuleMetadataRepository,
    private readonly requestContextService: RequestContextService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    // super(entityManager, repo, 'setting', 'solid-core', moduleRef);
  }

  private async getSettingsFromDb(): Promise<Setting[]> {
    const settings = await this.repo.find({ relations: ['user'] });
    return settings;
  }

  private parseSettingValue(value: string, key: string): any {
    try {
      return JSON.parse(value);
    } catch {
      if (value === 'true' || value === 'false') {
        return value === 'true';
      }
      if (!isNaN(Number(value)) && value.trim() !== '') {
        return Number(value);
      }
      if (!this.arrayKeysToSkip.has(key) && value.includes(',')) {
        return value.split(',').map(item => item.trim());
      }
      return value;
    }
  }

  /**
   * Reads all registered providers and gathers settings from across the running platform.
   * This is the superset of all possible settings. 
   * @returns 
   */
  private getAllSettingsFromProviders(): SettingDefinition[] {
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
   * public method that gets all settings in the system, this includes settings from solid-core and any consuming projects.
   * this means that the settings returned are the ones provided by ISettingsProvider, merged with values if any from the database. 
   * 
   * @returns 
   */
  getAllSettings(): SettingDefinition[] {
    return this.settings;
  }

  async updateSettingsCache(): Promise<void> {
    const settingsFromDb = await this.getSettingsFromDb();
    const settingsFromProviders = this.getAllSettingsFromProviders();
    const settingsFromDbByKey = new Map(settingsFromDb.map(setting => [setting.key, setting]));

    this.settings = settingsFromProviders.map(setting => {
      const settingFromDb = settingsFromDbByKey.get(setting.key);
      const valueFromDb = settingFromDb?.value;
      if (settingFromDb?.key && valueFromDb !== undefined && valueFromDb !== null) {
        const parsedValue = typeof valueFromDb === 'string' ? this.parseSettingValue(valueFromDb, settingFromDb.key) : valueFromDb;
        return { ...setting, value: parsedValue };
      }
      return setting;
    });
  }

  /**
   * 1. 
   * This method will seed (insert only) settings that are introduced in code but do not already exist in the database. 
   * Also this method only deals with settings with level system-admin-editable & internal-user.
   */
  async seedSystemAdminEditableAndAboveSettings(): Promise<void> {
    // Seed only settings with level system-admin-editable & internal-user, 
    // so basically settings which are either system-admin-editable and above.
    const saEditableAndAbove = this.getAllSettingsFromProviders().filter(i => [SettingLevel.SystemAdminEditable, SettingLevel.InternalUser].includes(i.level));

    // Get hold of the current values from the database.
    const existingSettingsFromDb: Setting[] = await this.getSettingsFromDb();

    // const existingKeysFromDb = new Set(existingSettingsFromDb.map(s => s.key));
    const existingSettingsFromDbByKey = new Map(existingSettingsFromDb.map(setting => [setting.key, setting]));
    const settingsToMutate: Setting[] = [];
    // const settingsToUpdate: Setting[] = [];

    for (const { key, value, level, moduleName } of saEditableAndAbove) {
      const moduleMetadata = await this.moduleMetadataRepo.findOneBy({ name: moduleName });
      if (!existingSettingsFromDbByKey.has(key)) {
        const setting = new Setting();
        setting.key = key;
        setting.level = level;
        if (moduleMetadata)
          setting.moduleMetadata = moduleMetadata;

        if (typeof value === 'boolean') {
          setting.value = value.toString();
        } else if (Array.isArray(value)) {
          setting.value = value.join(',');
        } else if (value === null || value === undefined) {
          setting.value = null;
        } else {
          setting.value = String(value);
        }

        settingsToMutate.push(setting);
      }
      else {
        const setting = existingSettingsFromDbByKey.get(key);
        setting.level = level;
        if (moduleMetadata)
          setting.moduleMetadata = moduleMetadata;
        settingsToMutate.push(setting);
      }
    }

    if (settingsToMutate.length > 0) {
      await this.repo.save(settingsToMutate);
    }
    // if (settingsToUpdate.length > 0) {
    //   await this.repo.save(settingsToUpdate);
    // }
  }

  /**
   * 2. 
   * Method used from the solid-core-ui to fetch available settings. 
   * Here we are returning settings other than system-env.
   * 
   * @returns 
   */
  async getSystemAdminReadonlyAndAboveSettings(): Promise<Record<any, any>> {
    const finalSettings: Record<any, any> = {};
    const systemAdminReadonlyAndAboveSettings = this.settings.filter(i => i.level !== "system-env");
    for (const setting of systemAdminReadonlyAndAboveSettings) {
      finalSettings[setting.key] = setting.value;
    }
    return finalSettings;
  }

  /**
   * 3. 
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
        const fileStorageDir = this.getConfigValue<SolidCoreSetting>("fileStorageDir")
        const storagePath = `${fileStorageDir}/${relativeFileName}`;
        const baseUrl = this.getConfigValue<SolidCoreSetting>("baseUrl") || '';
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
    await this.updateSettingsCache();

    return [...settingsToUpdate, ...settingsToCreate];
  }

  /**
   * 4. 
   * @param settingKey 
   * @returns 
   */
  getConfigValue<T = never>(settingKey: NoInfer<T>) {
    const cachedSetting = this.settings.find(setting => setting.key === settingKey);
    if (cachedSetting) {
      return cachedSetting.value;
    }

    // This is probably not needed at all, but leaving it here as a backup for scenarios like 
    // if getConfigValue<SolidCoreSetting>() is called before onApplicationBootstrap() runs or if the cache refresh fails. 
    const getAllSettings = this.getAllSettingsFromProviders();
    const settingValue = getAllSettings.find(i => (i.key == settingKey))
    return settingValue?.value;
  }

  async getMcpUrl(getMcpUrlDto: GetMcpUrlDto, solidRequestContext: any = {}): Promise<any> {

    const { showHeader, inListView } = getMcpUrlDto;

    const mcpEnabled = this.getConfigValue<SolidCoreSetting>('mcpEnabled');
    if (mcpEnabled === 'false' || mcpEnabled === false) {
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
    const apiKey = this.getConfigValue<SolidCoreSetting>('mcpApiKey');
    const userId = solidRequestContext.activeUser.sub;
    const mcpServerUrl = this.getConfigValue<SolidCoreSetting>('mcpServerUrl');
    return { mcpUrl: `${mcpServerUrl}/static/frontend.html?solidx-mcp-api-key=${apiKey}&solidx-user-id=${userId}&solidx-show-header=${showHeader}&solidx-in-list-view=${inListView}` };
  }

}

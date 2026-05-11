import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fsPromises from 'fs/promises';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { CreateSettingDto } from 'src/dtos/create-setting.dto';
import { GetMcpUrlDto } from 'src/dtos/get-mcp-url.dto';
import { User } from 'src/entities/user.entity';
import { SettingRepository } from '../repository/setting.repository';
import { FILE_SERVICE, IFileService, FILE_STORAGE_PATH_BUILDER, IStoragePathBuilder } from './file';
import { Setting } from '../entities/setting.entity';
import { RequestContextService } from './request-context.service';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { AdminSettingDefinition, AdminSettingsResponse, ISettingsProvider, NoInfer, SettingControlType, SettingDefinition, SettingLevel } from '../interfaces';
import { ModuleMetadataRepository } from 'src/repository/module-metadata.repository';
import type { SolidCoreSetting } from './settings/default-settings-provider.service';
import { Logger } from '@nestjs/common';
import { EncryptionService } from './encryption.service';


@Injectable()
export class SettingService {
  private readonly _logger = new Logger(SettingService.name);

  private settings: SettingDefinition[] = [];
  private settingsByKey = new Map<string, SettingDefinition>();
  private readonly encryptionService: EncryptionService | null;

  private readonly arrayKeysToSkip = new Set([
    'authenticationPasswordRegex',
    'authenticationPasswordRegexErrorMessage',
    'authenticationPasswordComplexityDescription',
  ]);

  constructor(
    @Inject(FILE_SERVICE) readonly fileService: IFileService,
    @Inject(FILE_STORAGE_PATH_BUILDER) readonly pathBuilder: IStoragePathBuilder,
    readonly solidRegistry: SolidRegistry,
    readonly repo: SettingRepository,
    readonly moduleMetadataRepo: ModuleMetadataRepository,
    private readonly requestContextService: RequestContextService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    const encKey = process.env.APP_ENCRYPTION_KEY;
    this.encryptionService = encKey ? new EncryptionService(encKey) : null;
    if (!encKey) this._logger.warn('APP_ENCRYPTION_KEY is not set — encrypted settings will not be decrypted');
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

  private buildSettingLabel(key: string): string {
    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private inferControlType(setting: SettingDefinition): SettingControlType {
    if (setting.controlType) {
      return setting.controlType;
    }

    if (setting.options?.length) {
      return 'selectionStatic';
    }

    if (typeof setting.value === 'boolean') {
      return 'boolean';
    }

    if (typeof setting.value === 'number') {
      return 'numeric';
    }

    return 'shortText';
  }

  private toAdminSettingDefinition(setting: SettingDefinition): AdminSettingDefinition {
    return {
      ...setting,
      label: setting.label ?? this.buildSettingLabel(setting.key),
      controlType: this.inferControlType(setting),
      editable: setting.level === SettingLevel.SystemAdminEditable,
    };
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
    const seenKeys = new Map<string, { setting: SettingDefinition; providerName?: string }>();
    for (const wrapper of allSettingsProviders) {
      const instance = wrapper.instance as ISettingsProvider;
      // if (!instance?.getSettings) continue;
      for (const setting of instance.getSettings()) {
        const existing = seenKeys.get(setting.key);
        if (existing) {
          throw new Error(
            `Duplicate setting key detected: ${setting.key}. ` +
            `First: ${JSON.stringify(existing.setting)} from provider: ${existing.providerName ?? "unknown"}. ` +
            `Second: ${JSON.stringify(setting)} from provider: ${wrapper.name ?? "unknown"}.`
          );
        }
        seenKeys.set(setting.key, { setting, providerName: wrapper.name });
        settings.push(setting);
      }
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
    this._logger.debug(`updating settings cache...`);
    const settingsFromDb = await this.getSettingsFromDb();
    const settingsFromProviders = this.getAllSettingsFromProviders();
    const settingsFromDbByKey = new Map(settingsFromDb.map(setting => [setting.key, setting]));

    this.settings = settingsFromProviders.map(setting => {
      const settingFromDb = settingsFromDbByKey.get(setting.key);
      const valueFromDb = settingFromDb?.value;
      if (settingFromDb?.key && valueFromDb !== undefined && valueFromDb !== null) {
        let rawValue = valueFromDb;
        if (settingFromDb.encrypted && this.encryptionService) {
          try {
            rawValue = this.encryptionService.decrypt(rawValue);
          } catch {
            this._logger.warn(`Failed to decrypt setting "${setting.key}" — using raw value`);
          }
        }
        const parsedValue = typeof rawValue === 'string' ? this.parseSettingValue(rawValue, settingFromDb.key) : rawValue;
        return { ...setting, value: parsedValue };
      }
      return setting;
    });

    // Also keep a key vs SettingDefinition map...
    this.settingsByKey = new Map(this.settings.map(setting => [setting.key, setting]));
  }

  private isDisallowedSettingKey(key: string, settingLevelsToDisallow: SettingLevel[]): boolean {
    if (!key) {
      return false;
    }
    const setting = this.settingsByKey.get(key);
    // return setting ? [SettingLevel.SystemEnv, SettingLevel.SystemAdminReadonly].includes(setting.level) : false;
    return setting ? settingLevelsToDisallow.includes(setting.level) : false;
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

    for (const { key, value, level, moduleName, encrypted } of saEditableAndAbove) {
      const moduleMetadata = await this.moduleMetadataRepo.findOneBy({ name: moduleName });
      if (!existingSettingsFromDbByKey.has(key)) {
        const setting = new Setting();
        setting.key = key;
        setting.level = level;
        setting.encrypted = !!encrypted;
        if (moduleMetadata)
          setting.moduleMetadata = moduleMetadata;

        let rawValue: string | null;
        if (typeof value === 'boolean') {
          rawValue = value.toString();
        } else if (Array.isArray(value)) {
          rawValue = value.join(',');
        } else if (value === null || value === undefined) {
          rawValue = null;
        } else {
          rawValue = String(value);
        }

        if (encrypted && this.encryptionService && rawValue !== null) {
          rawValue = this.encryptionService.encrypt(rawValue);
        }
        setting.value = rawValue;

        settingsToMutate.push(setting);
      }
      else {
        const setting = existingSettingsFromDbByKey.get(key);
        setting.level = level;
        setting.encrypted = !!encrypted;
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
  async getNonEncryptedSystemAdminReadonlyAndAboveSettings(): Promise<AdminSettingsResponse> {
    const data = this.settings
      .filter(i => i.level !== "system-env" && !i.encrypted)
      .filter((setting) => [SettingLevel.SystemAdminReadonly, SettingLevel.SystemAdminEditable].includes(setting.level))
      .map((setting) => this.toAdminSettingDefinition(setting))
      .sort((left, right) => {
        const groupCompare = (left.group ?? '').localeCompare(right.group ?? '');
        if (groupCompare !== 0) {
          return groupCompare;
        }

        const leftSort = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const rightSort = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (leftSort !== rightSort) {
          return leftSort - rightSort;
        }

        return left.label!.localeCompare(right.label!);
      });

    return { data };
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

    const restrictedKeys = new Set<string>();

    settings.forEach(setting => {
      if (this.isDisallowedSettingKey(setting.key, [SettingLevel.SystemEnv, SettingLevel.SystemAdminReadonly])) {
        restrictedKeys.add(setting.key);
      }
    });
    uploadedFiles.forEach(file => {
      if (this.isDisallowedSettingKey(file.fieldname, [SettingLevel.SystemEnv, SettingLevel.SystemAdminReadonly])) {
        restrictedKeys.add(file.fieldname);
      }
    });

    if (restrictedKeys.size > 0) {
      throw new BadRequestException(`${ERROR_MESSAGES.FORBIDDEN}: Settings ${Array.from(restrictedKeys).join(', ')} cannot be modified.`);
    }

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

        // Read file from local disk (where Multer stores uploads) and write to storage
        // The path builder constructs the provider-appropriate storage path
        const fileContent = await fsPromises.readFile(file.path);
        const storagePath = this.pathBuilder.build(relativeFileName);
        const fileUrl = await this.fileService.write(storagePath, fileContent, { contentType: file.mimetype });
        // Delete the temp file from local disk
        await fsPromises.unlink(file.path);

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
      const rawValue = settingDto.value;
      let value = rawValue === null || rawValue === undefined ? null : String(rawValue);

      const settingType = settingDto.type ?? 'system';
      const definition = this.settingsByKey.get(key);
      const shouldEncrypt = !!definition?.encrypted && this.encryptionService !== null && value !== null;

      if (shouldEncrypt) {
        value = this.encryptionService.encrypt(value);
      }

      const existingSetting = existingSettings.find(s => s.key === key);
      if (existingSetting) {
        existingSetting.value = value;
        existingSetting.type = settingType;
        existingSetting.encrypted = shouldEncrypt;
        settingsToUpdate.push(existingSetting);
      } else {
        const newSetting = new Setting();
        newSetting.key = key;
        newSetting.value = value;
        newSetting.type = settingType;
        newSetting.encrypted = shouldEncrypt;

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
    const cachedSetting = this.settingsByKey.get(settingKey as string);
    if (cachedSetting) {
      return cachedSetting.value;
    }

    return null;

    // const cachedSetting = this.settings.find(setting => setting.key === settingKey);
    // if (cachedSetting) {
    //   return cachedSetting.value;
    // }

    // // This is probably not needed at all, but leaving it here as a backup for scenarios like 
    // // if getConfigValue<SolidCoreSetting>() is called before onApplicationBootstrap() runs or if the cache refresh fails. 
    // const getAllSettings = this.getAllSettingsFromProviders();
    // const settingValue = getAllSettings.find(i => (i.key == settingKey))
    // return settingValue?.value;
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

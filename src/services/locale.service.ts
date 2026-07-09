import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Not } from 'typeorm';

import { Locale } from 'src/entities/locale.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { LocaleRepository } from 'src/repository/locale.repository';
import { CRUDService } from 'src/services/crud.service';
import { RequestContextService } from './request-context.service';
@Injectable()
export class LocaleService extends CRUDService<Locale> implements OnApplicationBootstrap{
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(Locale, 'default')
    // readonly repo: Repository<Locale>,
    readonly repo: LocaleRepository,
    // @InjectRepository(Locale, 'default')
    readonly moduleRef: ModuleRef,
    // @InjectRepository(ModelMetadata)
    // private readonly modelMetadataRepo: Repository<ModelMetadata>,
    // private readonly modelMetadataRepo: ModelMetadataRepository,
    readonly requestContextService: RequestContextService,
    readonly solidRegistry: SolidRegistry,
 ) {
   super(entityManager, repo, 'locale', 'solid-core', moduleRef);
 }
  private readonly logger = new Logger(LocaleService.name)
  onApplicationBootstrap() {
    // Load the security rules from the database
    this.loadLocales();
  }

  private async assertCanSetAsDefault(currentLocaleId?: number) {
    const defaultLocales = await this.repo.find({
      where: {
        isDefault: true,
      } as any,
    });

    const conflictingDefaultLocale = defaultLocales.find(
      (locale) => locale.id !== currentLocaleId
    );

    if (conflictingDefaultLocale) {
      throw new BadRequestException(
        `Locale "${conflictingDefaultLocale.displayName}" is already marked as default. Mark it as non-default first.`
      );
    }
  }

  override async create(createDto: any, files: Express.Multer.File[] = [], solidRequestContext: any = {}): Promise<Locale> {
    if (createDto?.isDefault === true) {
      await this.assertCanSetAsDefault();
    }

    const savedLocale = await super.create(createDto, files, solidRequestContext);
    await this.loadLocales();
    return savedLocale;
  }

  override async insertMany(createDtos: any[], filesArray: Express.Multer.File[][] = [], solidRequestContext: any = {}): Promise<Locale[]> {
    const defaultLocalesInPayload = (createDtos || []).filter((dto) => dto?.isDefault === true);

    if (defaultLocalesInPayload.length > 1) {
      throw new BadRequestException(`Only one locale can be marked as default.`);
    }

    if (defaultLocalesInPayload.length === 1) {
      await this.assertCanSetAsDefault();
    }

    const savedLocales = await super.insertMany(createDtos, filesArray, solidRequestContext);
    await this.loadLocales();
    return savedLocales;
  }

  override async update(id: number, updateDto: any, files: Express.Multer.File[] = [], isPartialUpdate: boolean = false, solidRequestContext: any = {}, isUpdate: boolean = false): Promise<Locale> {
    if (updateDto?.isDefault === true) {
      await this.assertCanSetAsDefault(id);
    }

    const savedLocale = await super.update(id, updateDto, files, isPartialUpdate, solidRequestContext, isUpdate);
    await this.loadLocales();
    return savedLocale;
  }

  override async recover(id: number, solidRequestContext: any = {}) {
    const localeToRecover = await this.repo.findOne({
      where: {
        id,
        deletedAt: Not(IsNull()),
      } as any,
      withDeleted: true,
    });

    if (localeToRecover?.isDefault) {
      await this.assertCanSetAsDefault(id);
    }

    const recoveredLocale = await super.recover(id, solidRequestContext);
    await this.loadLocales();
    return recoveredLocale;
  }

  override async recoverMany(ids: number[], solidRequestContext: any = {}) {
    const localesToRecover = await this.repo.find({
      where: {
        id: In(ids),
        deletedAt: Not(IsNull()),
      } as any,
      withDeleted: true,
    });

    const defaultLocalesToRecover = localesToRecover.filter((locale) => locale.isDefault);
    if (defaultLocalesToRecover.length > 1) {
      throw new BadRequestException(`Only one locale can be marked as default.`);
    }

    if (defaultLocalesToRecover.length === 1) {
      await this.assertCanSetAsDefault(defaultLocalesToRecover[0].id);
    }

    const recoveredLocales = await super.recoverMany(ids, solidRequestContext);
    await this.loadLocales();
    return recoveredLocales;
  }

  override async delete(id: number, solidRequestContext: any = {}) {
    const deletedLocale = await super.delete(id, solidRequestContext);
    await this.loadLocales();
    return deletedLocale;
  }

  override async deleteMany(ids: number[], solidRequestContext: any = {}) {
    const deletedLocales = await super.deleteMany(ids, solidRequestContext);
    await this.loadLocales();
    return deletedLocales;
  }

  async loadLocales() {
    const locales = await this.repo.find();
    this.logger.debug(`Loaded ${locales.length} locales into registry`);
    this.solidRegistry.registerlocales(locales);
  }
}

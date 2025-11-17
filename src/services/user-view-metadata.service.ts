import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';


import { UserViewMetadata } from '../entities/user-view-metadata.entity';
import { UpsertUserViewMetadataDto } from 'src/dtos/upsert-user-view-metadata.dto';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { UserViewMetadataRepository } from 'src/repository/user-view-metadata.repository';

@Injectable()
export class UserViewMetadataService extends CRUDService<UserViewMetadata> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(UserViewMetadata, 'default')
    // readonly repo: Repository<UserViewMetadata>,
    readonly repo: UserViewMetadataRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'userViewMetadata', 'solid-core', moduleRef);
  }

  async upsert(query: UpsertUserViewMetadataDto, activeUser: ActiveUserData) {
    const existing = await this.repo.findOne({
      where: { user: { id: activeUser?.sub }, viewMetadata: { id: query.viewMetadataId } }
    });

    if (existing) {
      existing.layout = JSON.parse(query.layout);
      return await this.repo.save(existing);
    } else {
      const newEntry = this.repo.create({
        user: { id: activeUser?.sub },
        viewMetadata: { id: query.viewMetadataId },
        layout: JSON.parse(query.layout)
      });
      return await this.repo.save(newEntry);
    }
  }

}

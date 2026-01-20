import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { UserViewMetadata } from '../entities/user-view-metadata.entity';
import { UpsertUserViewMetadataDto } from 'src/dtos/upsert-user-view-metadata.dto';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { UserViewMetadataRepository } from 'src/repository/user-view-metadata.repository';

@Injectable()
export class UserViewMetadataService extends CRUDService<UserViewMetadata> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(UserViewMetadata, 'default')
    // readonly repo: Repository<UserViewMetadata>,
    readonly repo: UserViewMetadataRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(entityManager, repo, 'userViewMetadata', 'solid-core', moduleRef);
  }

  async upsert(query: UpsertUserViewMetadataDto, activeUser: ActiveUserData) {
    const existing = await this.repo.findOne({
      where: { user: { id: activeUser?.sub }, viewMetadata: { id: query.viewMetadataId } }
    });

    if (existing) {
      existing.layout = query.layout;
      return await this.repo.save(existing);
    } else {
      const newEntry = this.repo.create({
        user: { id: activeUser?.sub },
        viewMetadata: { id: query.viewMetadataId },
        layout: query.layout
      });
      return await this.repo.save(newEntry);
    }
  }

}

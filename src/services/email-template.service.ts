import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaginationQueryDto } from 'src/dtos/pagination-query.dto';
import { EmailTemplate } from '../entities/email-template.entity';
import { CreateEmailTemplateDto } from '../dtos/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dtos/update-email-template.dto';
import { DiscoveryService } from "@nestjs/core";
import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { MediaStorageProviderMetadataService } from 'src/services/media-storage-provider-metadata.service';
import { ConfigService } from '@nestjs/config';
import { MediaService } from "src/services/media.service";
import { FileService } from "src/services/file.service";
import { CrudHelperService } from "src/services/crud-helper.service";

@Injectable()
export class EmailTemplateService extends CRUDService<EmailTemplate>{
    // constructor(
    //     @InjectRepository(EmailTemplate)
    //     private readonly emailTemplateRepo: Repository<EmailTemplate>,
    //     @InjectEntityManager()
    //     private readonly entityManager: EntityManager,
    // ) { }
      constructor(
        readonly modelMetadataService: ModelMetadataService,
        readonly moduleMetadataService: ModuleMetadataService,
        readonly mediaStorageProviderService: MediaStorageProviderMetadataService,
        readonly configService: ConfigService,
        readonly fileService: FileService,
        readonly mediaService: MediaService,
        readonly discoveryService: DiscoveryService,
        readonly crudHelperService: CrudHelperService,
        @InjectEntityManager()
        readonly entityManager: EntityManager,
        @InjectRepository(EmailTemplate)
        readonly repo: Repository<EmailTemplate>,
     ) {
       super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService,entityManager, repo, 'mqMessage', 'queues');
     }

    // create(createEmailTemplateDto: CreateEmailTemplateDto) {
    //     const entity = this.repo.create(createEmailTemplateDto);
    //     return this.repo.save(entity);
    // }

    // async findAll(paginationQuery: PaginationQueryDto) {
    //     const { limit, offset } = paginationQuery;

    //     return await this.emailTemplateRepo.find({
    //         skip: offset,
    //         take: limit,
    //     });
    // }

    async findOneByName(name: string, relations: any = {}) {
        const entity = await this.repo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        return entity;
    }

    // async findOne(id: number) {
    //     const entity = await this.emailTemplateRepo.findOne({
    //         where: {
    //             id: id,
    //         },
    //     });
    //     if (!entity) {
    //         throw new NotFoundException(`Email template #${id} not found`);
    //     }
    //     return entity;
    // }

    // async update(id: number, updateEmailTemplateDto: UpdateEmailTemplateDto) {
    //     const t = {
    //         id,
    //         ...updateEmailTemplateDto,
    //     };

    //     const entity = await this.emailTemplateRepo.preload(t);
    //     if (!entity) {
    //         throw new NotFoundException(`Email template #${id} not found`);
    //     }
    //     return this.emailTemplateRepo.save(entity);
    // }

    async removeByName(name: string) {
        const entity = await this.findOneByName(name);
        if (entity) {
            return await this.repo.remove(entity);
        }
    }

    async remove(id: number) {
        const entity = await this.repo.findOne({
            where: { id },
          });
        return this.repo.remove(entity);
    }

}

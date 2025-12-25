import { Injectable } from '@nestjs/common';
import { ModelSequence } from 'src/entities/model-sequence.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';
import { CreateModelSequenceDto } from 'src/dtos/create-model-sequence.dto';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { FieldMetadata } from 'src/entities/field-metadata.entity';

@Injectable()
export class ModelSequenceRepository extends SolidBaseRepository<ModelSequence> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(ModelSequence, dataSource, requestContextService, securityRuleRepository);
    }

    async upsertWithDto(createDto: CreateModelSequenceDto) {
        // Populate the module from moduleId or moduleUserKey
        const moduleRepository = this.dataSource.getRepository(ModuleMetadata);
        if (createDto.moduleId) {
            const module = await moduleRepository.findOne({
                where: {
                    id: createDto.moduleId,
                },
            });
            createDto['module'] = module;
        }

        if (createDto.moduleUserKey) {
            const module = await moduleRepository.findOne({
                where: {
                    name: createDto.moduleUserKey,
                },
            });
            createDto['module'] = module;
        }

        // Populate the model from modelId or modelUserKey
        const modelRepository = this.dataSource.getRepository(ModelMetadata);
        if (createDto.modelId) {
            const model = await modelRepository.findOne({
                where: {
                    id: createDto.modelId,
                },
            });
            createDto['model'] = model;
        }
        if (createDto.modelUserKey) {
            const model = await modelRepository.findOne({
                where: {
                    singularName: createDto.modelUserKey,
                },
            });
            createDto['model'] = model;
        }

        // Populate the field from fieldId or fieldUserKey
        const fieldRepository = this.dataSource.getRepository(FieldMetadata);
        if (createDto.fieldId) {
            const field = await fieldRepository.findOne({
                where: {
                    id: createDto.fieldId,
                },
            });
            createDto['field'] = field;
        }
        if (createDto.fieldUserKey) {
            const field = await fieldRepository.findOne({
                where: {
                    name: createDto.fieldUserKey,
                },
            });
            createDto['field'] = field;
        }

        // First check if sequence already exists using name
        const existingModelSequence = await this.findOne({
            where: {
                sequenceName: createDto.sequenceName,
            },
        });

        if (existingModelSequence) {
            const updatedModelSequence = this.merge(existingModelSequence, createDto);
            return this.save(updatedModelSequence);
        }
        else {
            const modelSequence = this.create(createDto);
            return this.save(modelSequence);
        }
    }
}
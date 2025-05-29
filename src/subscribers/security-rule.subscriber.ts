import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from "@nestjs/typeorm";
import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { SecurityRule } from 'src/entities/security-rule.entity';
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { SecurityRuleRepository } from 'src/repository/security-rule.repository';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
export class SecurityRuleSubscriber implements EntitySubscriberInterface<SecurityRule> {
    private readonly logger = new Logger(SecurityRuleSubscriber.name);
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        readonly securityRuleRepo: SecurityRuleRepository,
    ) {
        this.dataSource.subscribers.push(this);
    }

    listenTo() {
        return SecurityRule;
    }

    async afterInsert(event: InsertEvent<SecurityRule>) {
        await this.saveSecurityRules(event);
    }
    
    async afterUpdate(event: UpdateEvent<SecurityRule>) {
        await this.saveSecurityRules(event);
    }

    async saveSecurityRules(event: UpdateEvent<SecurityRule>| InsertEvent<SecurityRule>) {
        const securityRule = event.entity as SecurityRule;
        const modelMetadata = event.entity.modelMetadata;
        if (!modelMetadata) {
            this.logger.error(`Model metadata not found for security rule with id ${event.entity.id}`);
            return;
        }
        
        const modelMetadataRepo = this.dataSource.getRepository(ModelMetadata);
        const populatedModelMetadata = await modelMetadataRepo.findOne({
            where: {
                id: modelMetadata.id
            },
            relations: {
                module: true,
            }
        });

        const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(populatedModelMetadata.module.name);
        try {
            await fs.access(filePath);
        } catch (error) {
            // FIXME - Should we actually delete the security rule here, if the file is not found?
            this.logger.error(`File not found at path: ${filePath}`);
            return;
        }
        const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);

        if (metaData.securityRules) {
            const securityRuleIndex = metaData.securityRules?.findIndex((ruleFromFile: { name: string }) => ruleFromFile.name === securityRule.name);
            const {id, roleId, modelMetadataId, ...requiredDto} = await this.securityRuleRepo.toDto(securityRule)
            metaData.securityRules[securityRuleIndex] = {...requiredDto, securityRuleConfig: JSON.parse(securityRule.securityRuleConfig)}
        }
        else {
            const securityRules = []
            const {id, roleId, modelMetadataId, ...requiredDto} = await this.securityRuleRepo.toDto(securityRule)
            securityRules.push({...requiredDto, securityRuleConfig: JSON.parse(securityRule.securityRuleConfig)})
            metaData.securityRules = securityRules
        }
        // Write the updated object back to the file
        const updatedContent = JSON.stringify(metaData, null, 2);
        await fs.writeFile(filePath, updatedContent);
    }

}
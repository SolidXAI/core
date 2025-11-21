import { Injectable, Logger } from "@nestjs/common";
import { CreateSavedFiltersDto } from "src/dtos/create-saved-filters.dto";
import { ModelMetadata } from "src/entities/model-metadata.entity";
import { SavedFilters } from "src/entities/saved-filters.entity";
import { User } from "src/entities/user.entity";
import { ViewMetadata } from "src/entities/view-metadata.entity";
import { SolidRegistry } from "src/helpers/solid-registry";
import { CrudHelperService } from "src/services/crud-helper.service";
import { DataSource, Repository } from "typeorm";
import { SolidBaseRepository } from "./solid-base.repository";

@Injectable()
export class SavedFiltersRepository extends SolidBaseRepository<SavedFilters> {
    readonly logger = new Logger(SavedFiltersRepository.name);

    constructor(
        private dataSource: DataSource,
    ) {
        super(SavedFilters, dataSource, null , null);
    }

    /**
     * Converts an entity to a plain DTO object.
     */

    async upsertWithDto(dto: CreateSavedFiltersDto): Promise<SavedFilters> {
        const modelRepo = this.dataSource.getRepository(ModelMetadata);
        const viewRepo = this.dataSource.getRepository(ViewMetadata);

        // Find related entities based on keys from DTO
        const [modelEntity, viewEntity] = await Promise.all([
            modelRepo.findOne({ where: { singularName: dto.modelUserKey } }),
            viewRepo.findOne({ where: { name: dto.viewUserKey } }),
        ]);


        if (!modelEntity || !viewEntity) {
            throw new Error(
                `Missing related entity for SavedFilter: model=${dto.modelUserKey}, view=${dto.viewUserKey}`
            );
        }

        const filterData:Partial<SavedFilters> = {
            ...dto,
            isPrivate: false,
            user: null,
            model: modelEntity,
            view: viewEntity,
        };

        const existing = await this.findOne({
            where: { name: dto.name },
        });

        if (existing) {
            const merged = this.merge(existing, filterData);
            this.logger.debug(`Updating saved filter: ${dto.name}`);
            return this.save(merged);
        } else {
            this.logger.debug(`Creating saved filter: ${dto.name}`);
            return this.save(this.create(filterData));
        }
    }

}
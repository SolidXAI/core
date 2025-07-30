import { Injectable, Logger } from "@nestjs/common";
import { Dashboard } from "src/entities/dashboard.entity";
import { ViewMetadata } from "src/entities/view-metadata.entity";
import { DataSource, Repository, View } from "typeorm";

@Injectable()
export class ViewMetadataRepository extends Repository<ViewMetadata> {
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        private dataSource: DataSource,
    ) {
        super(ViewMetadata, dataSource.createEntityManager());
    }

    // Custom repository methods can be added here if needed
    async findByNameAndModelNameAndModuleName(name: string, modelUserKey: string, moduleUserKey: string): Promise<ViewMetadata | null> {
        const viewMetadata = await this.findOne({
            where: {
                name,
                model: {
                    singularName: modelUserKey,
                    module: {
                        name: moduleUserKey
                    }
                }
            }
        });
        return viewMetadata;
    }
}

import { CommonEntity } from "src/entities/common.entity";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
export declare class ViewMetadata extends CommonEntity {
    name: string;
    displayName: string;
    type: string;
    context: any;
    layout: any;
    module: ModuleMetadata;
    model: ModelMetadata;
}

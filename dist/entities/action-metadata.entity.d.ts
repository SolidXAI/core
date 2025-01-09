import { CommonEntity } from "src/entities/common.entity";
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { ViewMetadata } from 'src/entities/view-metadata.entity';
export declare class ActionMetadata extends CommonEntity {
    name: string;
    displayName: string;
    type: string;
    domain: any;
    context: any;
    customComponent: string;
    customIsModal: boolean;
    serverEndpoint: string;
    module: ModuleMetadata;
    model: ModelMetadata;
    view: ViewMetadata;
}

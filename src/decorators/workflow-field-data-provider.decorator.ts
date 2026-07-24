export const IS_WORKFLOW_FIELD_DATA_PROVIDER = 'IS_WORKFLOW_FIELD_DATA_PROVIDER';

export const WorkflowFieldDataProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_WORKFLOW_FIELD_DATA_PROVIDER, true, target);
    };
};

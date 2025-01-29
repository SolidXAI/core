export const IS_COMPUTED_FIELD_PROVIDER = 'IS_COMPUTED_FIELD_PROVIDER';

export const ComputedFieldProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_COMPUTED_FIELD_PROVIDER, true, target);
    };
};

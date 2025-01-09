export const IS_SELECTION_PROVIDER = 'IS_SELECTION_PROVIDER';

export const SelectionProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_SELECTION_PROVIDER, true, target);
    };
};

import 'reflect-metadata';

export const IS_ERROR_CODE_PROVIDER = 'IS_ERROR_CODE_PROVIDER';

export const ErrorCodeProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_ERROR_CODE_PROVIDER, true, target);
    };
};
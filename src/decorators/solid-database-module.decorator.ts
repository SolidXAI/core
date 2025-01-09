export const IS_SOLID_DATABASE_MODULE = 'IS_SOLID_DATABASE_MODULE';

export const SolidDatabaseModule = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_SOLID_DATABASE_MODULE, true, target);
    };
};

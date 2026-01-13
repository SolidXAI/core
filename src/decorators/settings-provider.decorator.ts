export const IS_SEtTTINGS_PROVIDER = 'IS_SEtTTINGS_PROVIDER';

export const SettingsProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_SEtTTINGS_PROVIDER, true, target);
    };
};

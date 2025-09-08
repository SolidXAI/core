export const IS_WA_PROVIDER = 'IS_WA_PROVIDER';

export const WhatsAppProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_WA_PROVIDER, true, target);
    };
};

export const IS_SMS_PROVIDER = 'IS_SMS_PROVIDER';

export const SmsProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_SMS_PROVIDER, true, target);
    };
};

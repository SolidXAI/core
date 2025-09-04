export const IS_MAIL_PROVIDER = 'IS_MAIL_PROVIDER';

export const MailProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_MAIL_PROVIDER, true, target);
    };
};

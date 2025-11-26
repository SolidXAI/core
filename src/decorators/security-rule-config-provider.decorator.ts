export const IS_SECURITY_RULE_CONFIG_PROVIDER = 'IS_SECURITY_RULE_CONFIG_PROVIDER';

export const SecurityRuleConfigProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_SECURITY_RULE_CONFIG_PROVIDER, true, target);
    };
};

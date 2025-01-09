import { QueuesModuleOptions } from './interfaces';
export declare const ConfigurableModuleClass: import("@nestjs/common").ConfigurableModuleCls<QueuesModuleOptions, "register", "create", {}>, QUEUES_MODULE_OPTION_TOKEN: string | symbol, OPTIONS_TYPE: QueuesModuleOptions & Partial<{}>, ASYNC_OPTIONS_TYPE: import("@nestjs/common").ConfigurableModuleAsyncOptions<QueuesModuleOptions, "create"> & Partial<{}>;
export declare const REQUEST_USER_KEY = "user";
export declare enum RegistrationValidationSource {
    EMAIL = "email",
    MOBILE = "mobile",
    TRANSACTIONAL = "transactional"
}
export declare enum TransactionalRegistrationValidationSource {
    EMAIL = "email",
    MOBILE = "mobile"
}
export declare enum ForgotPasswordSendVerificationTokenOn {
    EMAIL = "email",
    MOBILE = "mobile"
}

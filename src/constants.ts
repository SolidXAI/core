import { ConfigurableModuleBuilder } from '@nestjs/common';
import { QueuesModuleOptions } from './interfaces';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: QUEUES_MODULE_OPTION_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<QueuesModuleOptions>().build();
export const REQUEST_USER_KEY = 'user';

export enum RegistrationValidationSource {
  EMAIL = 'email',
  MOBILE = 'mobile',
  TRANSACTIONAL = 'transactional',
}

export enum TransactionalRegistrationValidationSource {
  EMAIL = 'email',
  MOBILE = 'mobile',
}

export enum ForgotPasswordSendVerificationTokenOn {
  EMAIL = 'email',
  MOBILE = 'mobile',
}
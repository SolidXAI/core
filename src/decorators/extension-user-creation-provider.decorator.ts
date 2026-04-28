export const IS_EXTENSION_USER_CREATION_PROVIDER = 'IS_EXTENSION_USER_CREATION_PROVIDER';

export const ExtensionUserCreationProvider = () =>
  (target: Function) =>
    Reflect.defineMetadata(IS_EXTENSION_USER_CREATION_PROVIDER, true, target);

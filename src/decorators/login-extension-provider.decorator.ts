import { SetMetadata } from "@nestjs/common";

export const IS_LOGIN_EXTENSION_PROVIDER = "IS_LOGIN_EXTENSION_PROVIDER";

export const LoginExtensionProvider = () =>
  SetMetadata(IS_LOGIN_EXTENSION_PROVIDER, true);

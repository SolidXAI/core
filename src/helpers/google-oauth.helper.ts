import { ConfigType } from "@nestjs/config";
import { iamConfig } from "src/config/iam.config";

export function isGoogleOAuthConfigured(iamConfiguration: ConfigType<typeof iamConfig>): boolean {
    const googleOauthConfig = iamConfiguration.googleOauth;
    
    return !!googleOauthConfig.clientID  
    && !!googleOauthConfig.clientSecret && !!googleOauthConfig.callbackURL && !!googleOauthConfig.redirectURL;
  }

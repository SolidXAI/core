import { DeviceMetadataDto } from "./device-metadata.dto";

export class OauthUserDto extends DeviceMetadataDto {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    picture: string;
    accessCode: string;
    accessToken: string;
    refreshToken: string;

}

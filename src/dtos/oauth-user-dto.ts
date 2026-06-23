import { UserDeviceMetadataDto } from "./user-device-metadata.dto";

export class OauthUserDto extends UserDeviceMetadataDto {
  provider: string;
  providerId: string;
  email: string;
  name: string;
  picture: string;
  accessCode: string;
  accessToken: string;
  refreshToken: string;
}

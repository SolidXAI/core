import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { UserDeviceMetadataDto } from "./user-device-metadata.dto";

export class SignInDto extends UserDeviceMetadataDto {
  @ApiProperty({ default: "sa@solidxai.com" })
  @IsEmail()
  // @IsNotEmpty()
  @IsOptional()
  email: string;

  @ApiProperty({ default: "sa" })
  @IsString()
  // @IsNotEmpty()
  @IsOptional()
  username: string;

  @ApiProperty({ default: "" })
  @IsOptional()
  password: string;
}

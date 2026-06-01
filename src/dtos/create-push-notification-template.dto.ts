import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

export class CreatePushNotificationTemplateDto {
  @IsNotEmpty()
  @Matches(/[a-z]+(-[a-z]+)*/)
  @IsString()
  @ApiProperty()
  name: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  displayName: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  title: string;

  @IsOptional()
  @IsString()
  @ApiProperty()
  body: string;

  @IsOptional()
  @IsObject()
  @ApiProperty()
  dataTemplate?: Record<string, string>;

  @IsOptional()
  @IsString()
  @ApiProperty()
  description?: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty()
  active: boolean = true;

  @IsOptional()
  @IsString()
  @ApiProperty()
  type?: string;
}

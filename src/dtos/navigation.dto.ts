import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { BasicFilterDto } from "./basic-filters.dto";

export class NavigationDto extends BasicFilterDto {
  
  @IsString()
  modelName: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  recordId: number;
}

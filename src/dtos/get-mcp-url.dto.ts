import { IsOptional, IsString } from "class-validator";

export class GetMcpUrlDto {

    @IsOptional()
    @IsString()
    showHeader?: string;

    @IsOptional()
    @IsString()
    inListView?: string;

}

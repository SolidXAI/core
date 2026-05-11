import { IsNotEmpty, IsString } from 'class-validator';

export class SsoExchangeDto {
    @IsNotEmpty()
    @IsString()
    code: string;
}

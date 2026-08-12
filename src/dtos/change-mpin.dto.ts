import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangeMpinDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(128)
    credentialRef: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(32)
    currentMpin: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(32)
    newMpin: string;
}

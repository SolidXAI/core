import { IsDate } from 'class-validator';
import { IsNotEmpty, IsString } from 'class-validator';
export class CreateExportTransactionDto {
@IsNotEmpty()
@IsDate()
datetime: Date;

@IsNotEmpty()
@IsString()
status: string;
}
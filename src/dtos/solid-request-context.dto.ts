import { IsOptional } from 'class-validator';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';

export class SolidRequestContextDto {

    
    @IsOptional()
    activeUser: ActiveUserData;
    
}

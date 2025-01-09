import { PartialType } from '@nestjs/swagger';
import { CreateSmsTemplateDto } from './create-sms-template.dto';

export class UpdateSmsTemplateDto extends PartialType(CreateSmsTemplateDto) { } { }

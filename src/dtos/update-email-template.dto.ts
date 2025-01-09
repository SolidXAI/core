import { PartialType } from '@nestjs/swagger';
import { CreateEmailTemplateDto } from './create-email-template.dto';

export class UpdateEmailTemplateDto extends PartialType(CreateEmailTemplateDto) { } { }

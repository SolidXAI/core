import { UpdateExportTemplateDto } from "./update-export-template.dto";

export class StartExportSyncDto extends UpdateExportTemplateDto {
    filters?: any;
  }
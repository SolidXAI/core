import { PartialType } from "@nestjs/mapped-types";
import { CreateModuleMetadataDto } from "./create-module-metadata.dto";

export class UpdateModuleMetadataDto extends PartialType(CreateModuleMetadataDto) {
}
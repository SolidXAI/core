import { PartialType } from "@nestjs/mapped-types";
import { CreateMediaStorageProviderMetadataDto } from "./create-media-storage-provider-metadata.dto";

export class UpdateMediaStorageProviderMetadataDto extends PartialType(CreateMediaStorageProviderMetadataDto) {
}
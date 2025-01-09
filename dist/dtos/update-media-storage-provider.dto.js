"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMediaStorageProviderMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const mapped_types_1 = require("@nestjs/mapped-types");
const create_media_storage_provider_metadata_dto_1 = require("./create-media-storage-provider-metadata.dto");
class UpdateMediaStorageProviderMetadataDto extends (0, mapped_types_1.PartialType)(create_media_storage_provider_metadata_dto_1.CreateMediaStorageProviderMetadataDto) {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdateMediaStorageProviderMetadataDto = UpdateMediaStorageProviderMetadataDto;
//# sourceMappingURL=update-media-storage-provider.dto.js.map
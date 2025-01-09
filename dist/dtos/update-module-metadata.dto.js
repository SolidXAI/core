"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateModuleMetadataDto = void 0;
const openapi = require("@nestjs/swagger");
const mapped_types_1 = require("@nestjs/mapped-types");
const create_module_metadata_dto_1 = require("./create-module-metadata.dto");
class UpdateModuleMetadataDto extends (0, mapped_types_1.PartialType)(create_module_metadata_dto_1.CreateModuleMetadataDto) {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdateModuleMetadataDto = UpdateModuleMetadataDto;
//# sourceMappingURL=update-module-metadata.dto.js.map
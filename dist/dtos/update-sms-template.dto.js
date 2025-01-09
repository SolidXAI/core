"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSmsTemplateDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const create_sms_template_dto_1 = require("./create-sms-template.dto");
class UpdateSmsTemplateDto extends (0, swagger_1.PartialType)(create_sms_template_dto_1.CreateSmsTemplateDto) {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdateSmsTemplateDto = UpdateSmsTemplateDto;
{ }
//# sourceMappingURL=update-sms-template.dto.js.map
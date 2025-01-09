"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEmailTemplateDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const create_email_template_dto_1 = require("./create-email-template.dto");
class UpdateEmailTemplateDto extends (0, swagger_1.PartialType)(create_email_template_dto_1.CreateEmailTemplateDto) {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdateEmailTemplateDto = UpdateEmailTemplateDto;
{ }
//# sourceMappingURL=update-email-template.dto.js.map
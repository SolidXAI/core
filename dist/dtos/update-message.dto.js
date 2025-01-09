"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMessageDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const create_message_dto_1 = require("./create-message.dto");
class UpdateMessageDto extends (0, swagger_1.PartialType)(create_message_dto_1.CreateMessageDto) {
    static _OPENAPI_METADATA_FACTORY() {
        return { startedAt: { required: true, type: () => Date }, finishedAt: { required: true, type: () => Date }, elapsedMillis: { required: true, type: () => Number }, output: { required: true, type: () => String }, error: { required: true, type: () => String } };
    }
}
exports.UpdateMessageDto = UpdateMessageDto;
//# sourceMappingURL=update-message.dto.js.map
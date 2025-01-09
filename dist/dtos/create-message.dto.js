"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMessageDto = void 0;
const openapi = require("@nestjs/swagger");
class CreateMessageDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { retryCount: { required: true, type: () => Number }, retryInterval: { required: true, type: () => Number }, messageType: { required: true, type: () => String }, stage: { required: true, type: () => String }, input: { required: true, type: () => String }, parentEntityId: { required: true, type: () => Number }, parentEntity: { required: true, type: () => String }, queueName: { required: true, type: () => String } };
    }
}
exports.CreateMessageDto = CreateMessageDto;
//# sourceMappingURL=create-message.dto.js.map
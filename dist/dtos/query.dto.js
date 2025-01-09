"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryDto = void 0;
const openapi = require("@nestjs/swagger");
class QueryDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { sort: { required: true, type: () => [String] }, filters: { required: true, type: () => Object }, populate: { required: true, type: () => Object }, fields: { required: true, type: () => [String] }, limit: { required: true, type: () => Number }, offset: { required: true, type: () => Number } };
    }
}
exports.QueryDto = QueryDto;
//# sourceMappingURL=query.dto.js.map
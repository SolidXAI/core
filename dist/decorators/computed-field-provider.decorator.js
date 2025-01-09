"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputedFieldProvider = exports.IS_COMPUTED_FIELD_PROVIDER = void 0;
exports.IS_COMPUTED_FIELD_PROVIDER = 'IS_COMPUTED_FIELD_PROVIDER';
const ComputedFieldProvider = () => {
    return (target) => {
        Reflect.defineMetadata(exports.IS_COMPUTED_FIELD_PROVIDER, true, target);
    };
};
exports.ComputedFieldProvider = ComputedFieldProvider;
//# sourceMappingURL=computed-field-provider.decorator.js.map
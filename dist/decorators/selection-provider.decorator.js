"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectionProvider = exports.IS_SELECTION_PROVIDER = void 0;
exports.IS_SELECTION_PROVIDER = 'IS_SELECTION_PROVIDER';
const SelectionProvider = () => {
    return (target) => {
        Reflect.defineMetadata(exports.IS_SELECTION_PROVIDER, true, target);
    };
};
exports.SelectionProvider = SelectionProvider;
//# sourceMappingURL=selection-provider.decorator.js.map
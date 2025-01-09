"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordSendVerificationTokenOn = exports.TransactionalRegistrationValidationSource = exports.RegistrationValidationSource = exports.REQUEST_USER_KEY = exports.ASYNC_OPTIONS_TYPE = exports.OPTIONS_TYPE = exports.QUEUES_MODULE_OPTION_TOKEN = exports.ConfigurableModuleClass = void 0;
const common_1 = require("@nestjs/common");
_a = new common_1.ConfigurableModuleBuilder().build(), exports.ConfigurableModuleClass = _a.ConfigurableModuleClass, exports.QUEUES_MODULE_OPTION_TOKEN = _a.MODULE_OPTIONS_TOKEN, exports.OPTIONS_TYPE = _a.OPTIONS_TYPE, exports.ASYNC_OPTIONS_TYPE = _a.ASYNC_OPTIONS_TYPE;
exports.REQUEST_USER_KEY = 'user';
var RegistrationValidationSource;
(function (RegistrationValidationSource) {
    RegistrationValidationSource["EMAIL"] = "email";
    RegistrationValidationSource["MOBILE"] = "mobile";
    RegistrationValidationSource["TRANSACTIONAL"] = "transactional";
})(RegistrationValidationSource || (exports.RegistrationValidationSource = RegistrationValidationSource = {}));
var TransactionalRegistrationValidationSource;
(function (TransactionalRegistrationValidationSource) {
    TransactionalRegistrationValidationSource["EMAIL"] = "email";
    TransactionalRegistrationValidationSource["MOBILE"] = "mobile";
})(TransactionalRegistrationValidationSource || (exports.TransactionalRegistrationValidationSource = TransactionalRegistrationValidationSource = {}));
var ForgotPasswordSendVerificationTokenOn;
(function (ForgotPasswordSendVerificationTokenOn) {
    ForgotPasswordSendVerificationTokenOn["EMAIL"] = "email";
    ForgotPasswordSendVerificationTokenOn["MOBILE"] = "mobile";
})(ForgotPasswordSendVerificationTokenOn || (exports.ForgotPasswordSendVerificationTokenOn = ForgotPasswordSendVerificationTokenOn = {}));
//# sourceMappingURL=constants.js.map
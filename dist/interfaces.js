"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerType = exports.EventDetails = exports.EventType = void 0;
var EventType;
(function (EventType) {
    EventType["USER_REGISTERED"] = "user.registered";
})(EventType || (exports.EventType = EventType = {}));
class EventDetails {
    constructor(type, payload) {
        this.type = type;
        this.payload = payload;
    }
}
exports.EventDetails = EventDetails;
var BrokerType;
(function (BrokerType) {
    BrokerType["RabbitMQ"] = "rabbitmq";
})(BrokerType || (exports.BrokerType = BrokerType = {}));
//# sourceMappingURL=interfaces.js.map
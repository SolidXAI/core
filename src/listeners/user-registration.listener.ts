
import { User } from "../entities/user.entity";
import { OnEvent } from "@nestjs/event-emitter";
import { Injectable, Logger } from "@nestjs/common";
import { EventDetails, EventType } from "../interfaces";

@Injectable()
export class UserRegistrationListener {
    private logger = new Logger(UserRegistrationListener.name);
    @OnEvent(EventType.USER_REGISTERED)
    handleUserRegistration(event: EventDetails<User>) {
        this.logger.log(`User registered with details: ${JSON.stringify(event.payload)}`);
    }
}
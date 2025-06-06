import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { User } from "src/entities/user.entity";
import { ActiveUserData } from "src/interfaces/active-user-data.interface";
import { RequestContextService } from "src/services/request-context.service";
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";

@Injectable()
@EventSubscriber()
export class CreatedByUpdatedBySubscriber implements EntitySubscriberInterface {
    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly requestContextService: RequestContextService,
    ) {
        this.dataSource.subscribers.push(this);
    }

    async beforeInsert(event: InsertEvent<any>) {
        await this.stampUserField(event, true);
    }

    async beforeUpdate(event: UpdateEvent<any>) {
        await this.stampUserField(event, false);
    }

    private async stampUserField(event: InsertEvent<any> | UpdateEvent<any>, isInsert: boolean){
        if (!event.entity) {
            return;
        }
        // Get the current active user details from the request context
        const activeUserOrUndefined = this.requestContextService.getActiveUser();
        if (!activeUserOrUndefined) {
            return;
        }

        const loadedUser = await this.loadUser(activeUserOrUndefined as unknown as ActiveUserData);
        if (isInsert) {
            event.entity.createdBy = loadedUser;
            event.entity.updatedBy = loadedUser; // For insert, we set both createdBy and updatedBy to the same user
        }
        else {
            event.entity.updatedBy = loadedUser;
        }
    }

    private async loadUser(activeUser: ActiveUserData): Promise<User> {
        const userRepo = this.dataSource.getRepository(User); // Assuming 'User' is the entity name for users in your application
        const loadedUser = await userRepo.findOne({
            where: { id: activeUser.sub }, // Assuming 'sub' is the user ID in the JWT token
        });
        return loadedUser;;
    }
}
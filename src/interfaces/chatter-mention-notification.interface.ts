export interface ChatterMentionNotificationMention {
    id?: number;
    username: string;
    displayName: string;
}

export interface ChatterMentionNotificationActor {
    id?: number;
    username?: string;
    email?: string;
}

export interface ChatterMentionNotificationEntity {
    id: number;
    modelName: string;
    moduleName?: string;
    displayName: string;
    userKey?: string;
}

export interface ChatterMentionNotificationPayload {
    templateName: string;
    mentions: ChatterMentionNotificationMention[];
    actor: ChatterMentionNotificationActor;
    noteBody: string;
    entity: ChatterMentionNotificationEntity;
    parentEntity: string;
    parentEntityId: number;
}

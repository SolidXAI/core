import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import { QueueMessage, QueuePublisher } from 'src/interfaces/mq';
import { classify } from '@angular-devkit/core/src/utils/strings';
import { SolidIntrospectService } from '../solid-introspect.service';
import { IMcpToolResponseHandler } from 'src/interfaces';


@Injectable()
export class McpToolResponseHandlerFactory {
    private readonly logger = new Logger(McpToolResponseHandlerFactory.name);

    constructor(
        private readonly solidIntrospectionService: SolidIntrospectService
    ) {
    }

    getInstance(toolInvoked: string): IMcpToolResponseHandler {
        toolInvoked = classify(toolInvoked);

        let resolvedHandlerName = `${toolInvoked}McpToolResponseHandler`;

        // Register all ISolidDatabaseModules implementations
        let actualHandler = this.solidIntrospectionService.getProvider(resolvedHandlerName);
        if (!actualHandler) {
            throw new Error(`Unable to locate mcp tool handler with name ${resolvedHandlerName}`);
        }

        // type safe
        const actualHandlerInstance: IMcpToolResponseHandler = actualHandler.instance;
        this.logger.error(`Resolved mcp tool response handler with name ${actualHandler.name}`);

        return actualHandlerInstance;
    }
}

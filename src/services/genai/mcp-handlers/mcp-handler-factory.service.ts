import { Injectable, Logger } from '@nestjs/common';

import { classify } from '@angular-devkit/core/src/utils/strings';
import { IMcpToolResponseHandler } from 'src/interfaces';
import { SolidIntrospectService } from '../../solid-introspect.service';


@Injectable()
export class McpHandlerFactory {
    private readonly logger = new Logger(McpHandlerFactory.name);

    constructor(
        private readonly solidIntrospectionService: SolidIntrospectService
    ) {
    }

    getInstance(toolInvoked: string): IMcpToolResponseHandler {
        toolInvoked = classify(toolInvoked);

        let resolvedHandlerName = `${toolInvoked}McpHandler`;

        // Get hold of the tool response handler instance using the tool name used. 
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

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { InvokeAiPromptDto } from 'src/dtos/invoke-ai-prompt.dto';
import { McpResponse, TriggerMcpClientOptions } from 'src/interfaces';
import { AiInteractionRepository } from 'src/repository/ai-interaction.repository';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { AiInteraction } from '../entities/ai-interaction.entity';
import { McpHandlerFactory } from './genai/mcp-handlers/mcp-handler-factory.service';
import { PublisherFactory } from './queues/publisher-factory.service';

@Injectable()
export class AiInteractionService extends CRUDService<AiInteraction> {
  private readonly logger = new Logger(AiInteractionService.name);

  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(AiInteraction, 'default')
    // readonly repo: Repository<AiInteraction>,
    readonly repo: AiInteractionRepository,
    readonly moduleRef: ModuleRef,
    readonly publisherFactory: PublisherFactory<TriggerMcpClientOptions>,
    // readonly requestContextService: RequestContextService,
    readonly mcpHandlerFactory: McpHandlerFactory,

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'aiInteraction', 'solid-core', moduleRef);
  }

  async triggerMcpClientJob(dto: InvokeAiPromptDto, userId: number, isAutoApply: boolean = false, threadId: string = null): Promise<any> {
    // const activeUser: ActiveUserData = this.requestContextService.getActiveUser();

    const aiInteraction = await this.create({
      userId: userId,
      threadId: threadId ? threadId : `thread-${userId}`,
      role: 'human',
      message: dto.prompt,
      contentType: '',
      errorMessage: '',
      modelUsed: '',
      responseTimeMs: 0,
      metadata: '',
      isAutoApply: isAutoApply
    });
    const m = {
      payload: {
        aiInteractionId: aiInteraction.id,
        moduleName: dto.moduleName
      },
      parentEntity: 'aiInteraction',
      parentEntityId: aiInteraction.id,
    };

    const queueMessageId = await this.publisherFactory.publish(m, 'TriggerMcpClientPublisher');

    return {
      queueMessageId: queueMessageId,
      aiInteractionId: aiInteraction.id
    }
  }

  /**
   * Runs the Python MCP client with a prompt and returns the parsed JSON embedded in the 'response'.
   * @param prompt - The question or instruction to send to the MCP client.
   * @returns The parsed object inside the 'response' field of the JSON output.
   */
  async runMcpPrompt(prompt: string): Promise<McpResponse> {
    const pythonExecutable = process.env.MCP_PYTHON_EXECUTABLE;
    const mcpClient = process.env.MCP_CLIENT;

    // TODO: We can return an error if the above env variables are not properly setup...
    if (!pythonExecutable || !mcpClient) {
      throw new BadRequestException(ERROR_MESSAGES.PYTHON_EXECUTABLE_NOT_CONFIGURED);
    }

    // Check if both paths are valid and accessible
    try {
      const [pyStat, clientStat] = await Promise.all([
        fs.stat(pythonExecutable),
        fs.stat(mcpClient),
      ]);

      if (!pyStat.isFile()) {
        throw new BadRequestException(`MCP_PYTHON_EXECUTABLE path is not a file: ${pythonExecutable}`);
      }

      if (!clientStat.isFile()) {
        throw new BadRequestException(`MCP_CLIENT path is not a file: ${mcpClient}`);
      }

    } catch (err: any) {
      throw new BadRequestException(`Invalid MCP executable or client path: ${err.message}`);
    }

    // TODO: Refactor to use the command.service.ts instead...
    return new Promise((resolve, reject) => {
      this.logger.log(`Attempting to run command:`)
      this.logger.log(`${pythonExecutable} ${mcpClient} "${prompt}"`);

      const python = spawn(pythonExecutable, [mcpClient, `"${prompt}"`]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        this.logger.log(`Python script exited with code ${code}`);

        if (code !== 0) {
          this.logger.error(`Python script exited with a non-zero exit code: ${stderr}`);
          return reject(new Error(`Python script exited with a non-zero exit code: ${stderr}`));
        }

        try {
          this.logger.log(`Python script exited with zero exit code: ${stdout}`);
          const raw: McpResponse = JSON.parse(stdout);

          // Sometimes the raw.response might not be a valid json
          // TODO: examine the content type of the raw response..
          // if (raw.content_type==='json') {
          // }
          let parsedResponse = raw.response;
          try {
            parsedResponse = JSON.parse(raw.response);
          }
          catch (ex) {
            this.logger.warn(`Attempting to parse mcp client response assuming it is JSON, however it is not: ${parsedResponse}`);
            // raw.success = false
          }
          // Parse the response string into an object
          // const parsedResponse = JSON.parse(raw.response);

          // Replace the string with the parsed object
          const enrichedRaw = {
            ...raw,
            response: parsedResponse,
          };
          // if (!raw.success) {
          //   return reject(new Error(`MCP error: ${raw.errors?.join(', ')}`));
          // }
          // let cleaned = raw.response.trim();

          // Don't need to re-parse this...
          // const parsed = JSON.parse(cleaned);
          // resolve(cleaned);

          resolve(enrichedRaw);
        } catch (err: any) {
          reject(new Error(`Mcp Invocation Failed: ${err.message}`));
        }
      });
    });
  }

  cleanResponse(response: string) {
    this.logger.log(`mcp server response is: ${response}`);

    // Remove markdown-style code block wrapper
    if (response.startsWith('```json')) {
      response = response.replace(/^```json/, '').trim();
    }
    if (response.endsWith('```')) {
      response = response.replace(/```$/, '').trim();
    }
    this.logger.log(`mcp server response after removing doc tags is: ${response}`);

    return response;
  }

  async applySolidAiInteraction(id: number) {
    // Fetch the aiInteraction
    const aiInteraction = await this.findOne(id, {
      populate: ['user']
    });
    if (!aiInteraction) {
      const m = `Unable to identified the aiInteraction entry that triggered this job... using id: ${id}`

      // TODO: RESPONSE SHAPE ALERT Check if we want to control the shape of the response....
      throw new Error(m);
    }

    // TODO: Validation: Check if JSON.parse(metadata).tools_invoked starts with solid_
    let metadata: any = {};
    try {
      if (typeof aiInteraction.metadata === "string") {
        metadata = JSON.parse(aiInteraction.metadata);
      } else if (typeof aiInteraction.metadata === "object" && aiInteraction.metadata !== null) {
        metadata = aiInteraction.metadata;
      } else {
        // optional fallback
        metadata = {};
      }
    } catch (e) {
      // TODO: RESPONSE SHAPE ALERT Check if we want to control the shape of the response....
      throw new Error(`Invalid metadata JSON: ${e}`);
    }

    const toolsInvoked = metadata['tools_invoked'];
    if (!toolsInvoked) {
      // TODO: RESPONSE SHAPE ALERT Check if we want to control the shape of the response....
      throw new Error(ERROR_MESSAGES.UNABLE_TO_RESOLVE_SOLID_COMMAND);
    }

    // TODO: OPTIMISATION for chained tool invocation, for now we are assuming only 1 tool was used.
    const toolInvoked = toolsInvoked[0];

    // TODO: use the toolInvoked to identify a service using some convention.
    // TODO: Eg. if toolInvoked is solid_create_module <> SolidCreateModuleMcpToolHandler ... create a factory class to do this mapping and identify the relevant provider. 
    const mcpToolHandler = this.mcpHandlerFactory.getInstance(toolInvoked);
    if (!mcpToolHandler) {
      // TODO: RESPONSE SHAPE ALERT Check if we want to control the shape of the response....
      throw new Error(ERROR_MESSAGES.UNABLE_TO_RESOLVE_MCP_HANDLER);
    }

    const handlerApplicationResponse = await mcpToolHandler.apply(aiInteraction);

    // TODO: This provider to implement an interface - IMcpToolResponseHandler ... apply(aiInteraction: AiInteraction)
    // throw new Error('Method not implemented.');

    // Mark the interaction as applied
    await this.update(aiInteraction.id, { isApplied: true }, [], true);

    return handlerApplicationResponse;
  }
}

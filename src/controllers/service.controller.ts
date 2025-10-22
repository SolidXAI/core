import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from 'src/decorators/active-user.decorator';
import { Public } from 'src/decorators/public.decorator';
import { ErrorMapperService } from 'src/helpers/error-mapper.service';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { AiInteractionService } from 'src/services/ai-interaction.service';
import { IngestMetadataService } from 'src/services/genai/ingest-metadata.service';
import { MqMessageService } from 'src/services/mq-message.service';
import { SolidRegistry } from '../helpers/solid-registry';

export interface PostProcessCodeGenConfig {
    runModuleMetadataSeeder?: boolean; // If true, regenerate module metadata
    runSolidIngestion?: boolean; // If true, run solid ingestion command
}
@Controller('')
@ApiTags("Common")
// @UseGuards(ThrottlerGuard)
// @SkipThrottle({ short: true, login: true, burst: true, sustained: true }) // Skip all
export class ServiceController {
    private readonly logger = new Logger(ServiceController.name);

    constructor(
        private readonly solidRegistry: SolidRegistry,
        private readonly aiInteractionService: AiInteractionService,
        private readonly mqMessageService: MqMessageService,
        private readonly errorMapper: ErrorMapperService,
        private readonly ingestMetadataService: IngestMetadataService,
        
    ) { }

    @Public()
    @Get('ping')
    pingPong() {
        return { pong: 'v1.0.2' };
    }

    @ApiBearerAuth("jwt")
    @Get('mcp/ping')
    async mcpPingPong(@ActiveUser() activeUser: ActiveUserData) {
        // TODO: do a MCP client invocation, wait for response and return.
        // If failure then decide shape to return.

        const threadId = `pingPongTxn-${activeUser.sub}`;
        const dto ={prompt:"Can you do 1 + 1", moduleName:"solidCoreModule"}
        const { queueMessageId, aiInteractionId } = await this.aiInteractionService.triggerMcpClientJob(
            dto,
            activeUser.sub,
            true,
            threadId
        );

        this.logger.debug(`mcp ping pong job triggered: queueMessageId=${queueMessageId}, aiInteractionId=${aiInteractionId}`);

        // Wait up to 2 minutes, start at 500ms poll, back off to max 2s, throw if failed:
        const result = await this.mqMessageService.waitForTerminalStatus(queueMessageId, {
            timeoutMs: 2 * 60 * 1000,
            intervalMs: 500,
            maxIntervalMs: 2000,
            throwOnFailure: false,
        });

        this.logger.debug(`mcp ping pong job finished with stage=${result.stage}`)

        this.logger.debug(`mcp ping pong trying to find genai (child) interaction for aiInteraction for id=${aiInteractionId}`)

        // @ts-ignore
        const genAiInteractions = await this.aiInteractionService.find({
            filters: {
                parentInteraction: {
                    id: {
                        $eq: aiInteractionId
                    }
                }
            }
        });

        const genAiInteraction = genAiInteractions['records'][0];
        this.logger.debug(genAiInteraction.message);

        this.logger.debug(`identified gen-ai interaction with id=${genAiInteraction.id}`);
        this.logger.debug(`proceeding with applying the gen-ai interaction`)

        return {
            mcpPong: 'v1.0.2',
            genAiInteraction: {
                status: genAiInteraction.status,
                errorCode: genAiInteraction.status === 'failed' ? this.errorMapper.mapMessage(genAiInteraction.errorMessage, genAiInteraction.metadata) : '',
                errorMessage: genAiInteraction.errorMessage,
            }
        };
    }

    @Public()
    // @SkipThrottle({ short: false, login: true, burst: true, sustained: true }) //Enable the short throttle only
    @Post('seed')
    async seedData(@Body() seedData: any) {
        const seeder = this.solidRegistry
            .getSeeders()
            .filter((seeder) => seeder.name === seedData.seeder)
            .map((seeder) => seeder.instance)
            .pop();
        if (!seeder) {
            this.logger.error(`Seeder service ${seedData.seeder} not found. Does your service have a seed() method?`);
            return;
        }
        this.logger.log(`Running the seed() method for seeder :${seeder.constructor.name}`);
        await seeder.seed();
        return { message: `seed data for ${seedData.seeder}` };
    }

    @ApiBearerAuth("jwt")
    @Post('code-generation/post-process')
    async postProcessCodeGeneration(@Body() config : PostProcessCodeGenConfig) {
        // Set defaults if not provided
        config.runModuleMetadataSeeder = config.runModuleMetadataSeeder ?? true;
        config.runSolidIngestion = config.runSolidIngestion ?? true;

        // Run the Module Metadata Seeder Service
        if (config.runModuleMetadataSeeder) {
            this.logger.debug(`Running the Module Metadata Seeder Service as part of post-process code generation`);
            const seeder = this.solidRegistry
                .getSeeders()
                .filter((seeder) => seeder.name === 'ModuleMetadataSeederService')
                .map((seeder) => seeder.instance)
                .pop();
            if (!seeder) {
                this.logger.error(`Seeder service ModuleMetadataSeederService not found. Does your service have a seed() method?`);
            } else {
                await seeder.seed();
            }
        } else {
            this.logger.debug(`Skipping the Module Metadata Seeder Service as part of post-process code generation`);
        }
        
        // Run the Solid ingestion command
        if (config.runSolidIngestion) {
            this.logger.debug(`Running the Solid ingestion command as part of post-process code generation`);

            // TODO: disabled this till we figure out a way to make this stable...
            // This keeps failing for a variety of reasons... 
            // await this.ingestMetadataService.ingest();
        }
    }


    // @Public()
    // @Get('play')
    // play() {
    //     return this.solidRegistry.getControllers();
    // }

    //   //This method identifies a provider as a seeder if it has a seed method i.e duck typing
    //   private isSeeder(provider: InstanceWrapper) {
    //     const { instance } = provider;
    //     if (!instance) return false;

    //     const seedMethod = this.metadataScanner
    //       .getAllMethodNames(Object.getPrototypeOf(instance))
    //       .find((methodName) => methodName === 'seed');
    //     if (!seedMethod) return false;
    //     return true;
    //   }

}

import { Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { CreateFixtureDto, FixtureStatus } from "src/dtos/create-fixture.dto";
import { ModelMetadataHelperService } from "src/helpers/model-metadata-helper.service";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { FixtureService } from "./fixture.service";
import { SHA256HashService } from "./sha-256-hash.service";
import { CreateFixtureModelDto } from "src/dtos/create-fixture-model.dto";
import { FixtureModelService } from "./fixture-model.service";
import { Fixture } from "src/entities/fixture.entity";

interface IFixture {
    scenarioName: string;
    scenarioDescription: string;
    models: {
        singularName: string;
        data: unknown;
    }[];
}

// This service can contain common logic for fixtures setup and tear down
@Injectable()
export class FixtureHelperService {
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        private readonly moduleMetadataHelper: ModuleMetadataHelperService,
        private readonly modelMetadataHelper: ModelMetadataHelperService,
        private readonly fixturesService: FixtureService,
        private readonly fixturesModelsService: FixtureModelService, // Placeholder for actual FixturesModelsService
        private readonly sha256HashService: SHA256HashService,
    ) { }

    async setupFixtures(moduleName: string, scenarioName: string) {
        // Load the scenario fixture from module metadata
        const scenarioFixture = await this.loadFixtureFromJson(moduleName, scenarioName);

        // Calculate checksum/hash of the fixture json config
        const alreadySetup = await this.isAlreadySetup(scenarioFixture);
        if (alreadySetup) {
            this.logger.log(`Fixture for scenario: ${scenarioName} in module: ${moduleName} is already setup. Skipping setup.`);
            return;
        }

        // Initiate the fixture setup process by creating an entry in the fixtures table
        const fixtureId = await this.initiateFixtureSetup(moduleName, scenarioFixture);

        // For each model in the fixtures, load the appropriate model service and create the instance
        for (const modelFixture of scenarioFixture.models) {
            const modelServiceInstance = await this.modelMetadataHelper.loadModelService(modelFixture.singularName);
            try {
                // Create the model instance in the database
                const createdInstance = await modelServiceInstance.create(modelFixture.data);
                this.logger.debug(`Successfully created fixture for model: ${modelFixture.singularName} with ID: ${createdInstance.id}`);

                // Store the created instance details in the fixtures_models tracking table, with the createdInstance id - TODO
                await this.trackFixtureModelSetup(fixtureId, modelFixture.singularName, createdInstance.id, scenarioFixture);
            } catch (error) {
                throw new InternalServerErrorException(`Error creating fixture for scenario ${scenarioName} for model: ${modelFixture.singularName} - ${error.message}`);
            }
        }

        // Update the entry in the fixtures table with status as APPLIED
        await this.completeFixtureSetup(fixtureId);
    }

    async tearDownFixtures(moduleName: string, scenarioName: string) {
        const appliedFixtures = await this.loadFixtureFromDb(moduleName, scenarioName);

        // For each model in reverse order
        /*
        for (const modelFixture of appliedFixtures.models.reverse()) {
            const modelServiceInstance = await this.modelMetadataHelper.loadModelService(modelFixture.singularName);

            // Get the user key field for the model to identify the created instances
            try {
                // Assuming we have some way to identify the created instances, e.g., by a unique field in data
                await modelServiceInstance.delete();
                this.logger.log(`Successfully deleted fixture for model: ${modelFixture.singularName}`);
            } catch (error) {
                this.logger.error(`Error deleting fixture for model: ${modelFixture.singularName} - ${error.message}`);
            }
        }*/
    }

    private async loadFixtureFromDb(moduleName: string, scenarioName: string): Promise<Fixture> {
        // Fetch the fixture entry from the fixtures table using FixturesService - TODO
        const filterDto = {
            filters: {
                moduleName: {
                    $eq: moduleName,
                },
                scenarioName: {
                    $eq: scenarioName,
                },
                status: {
                    $eq: FixtureStatus.APPLIED,
                }
            }
        };
        const fixtureEntries = await this.fixturesService.find(filterDto);
        if (!fixtureEntries || fixtureEntries.records.length === 0) {
            throw new NotFoundException(`Fixture not found for module: ${moduleName} and scenario: ${scenarioName}`);
        }
        this.logger.debug(`Fixture entry found in DB for module: ${moduleName} and scenario: ${scenarioName}`);
        return fixtureEntries.records[0];
    }

    private async loadFixtureFromJson(moduleName: string, scenarioName: string): Promise<IFixture> {
        // Read the module metadata file based on module name
        const moduleMetadataConfiguration = await this.moduleMetadataHelper.getModuleMetadataConfiguration(
            await this.moduleMetadataHelper.getModuleMetadataFilePath(moduleName)
        );
        if (!moduleMetadataConfiguration) {
            throw new NotFoundException("Module metadata configuration not found for module: " + moduleName);
        }
        this.logger.debug(`Module Metadata Configuration loaded for module: ${moduleName}`);

        // Read the fixtures json from above file
        const allFixtures = moduleMetadataConfiguration?.fixtures;
        this.logger.verbose(`All Fixtures: ${JSON.stringify(allFixtures)}`);
        // Check if scenarios exists
        if (!allFixtures || allFixtures?.length === 0) {
            throw new NotFoundException("No fixture scenarios defined in the module metadata configuration for module: " + moduleName);
        }

        // Find the fixtures for the given scenario
        const scenarioFixture = allFixtures.find((fixture: IFixture) => fixture.scenarioName === scenarioName);
        if (!scenarioFixture) {
            throw new NotFoundException("Fixture scenario not found: " + scenarioName + " in module: " + moduleName);
        }
        this.logger.debug(`Fixture for Scenario: ${scenarioName} found with fixtures to setup.`);

        // Validate if models exist in the scenario
        if (!scenarioFixture?.models || scenarioFixture.models.length === 0) {
            throw new NotFoundException(`No models found to setup for fixture with scenario: ${scenarioName} in module: ${moduleName}`);
        }
        return scenarioFixture;
    }

    private async initiateFixtureSetup(moduleName: string, scenarioFixture: IFixture): Promise<number> {
        // Create the fixture entry in the fixtures table using the FixturesRepository - TODO
        const fixturesDto: CreateFixtureDto = {
            moduleName: moduleName,
            scenarioName: scenarioFixture.scenarioName,
            scenarioDescription: scenarioFixture.scenarioDescription,
            data: scenarioFixture,
            status: FixtureStatus.IN_PROGRESS,
        }
        const newFixture = await this.fixturesService.create(fixturesDto); 
        return newFixture.id;
    }

    private async completeFixtureSetup(fixtureId: number) {
        const patchDto = {
            id : fixtureId,
            status: FixtureStatus.APPLIED,
        }
        await this.fixturesService.update(fixtureId, patchDto, [], true);
    }

    private async trackFixtureModelSetup (fixtureId: number, modelSingularName: string, createdInstanceId: number, scenarioFixture: IFixture) {
        const modelFixture = scenarioFixture.models.find(m => m.singularName === modelSingularName);

        // Create entry in the fixtures_models tracking table - TODO
        const fixtureModelDto: CreateFixtureModelDto = {
            fixtureId: fixtureId,
            fixtureUserKey: null,
            modelSingularName: modelSingularName,
            modelId: createdInstanceId,
            modelData: modelFixture,
        };

        const newFixturesModelsEntity = await this.fixturesModelsService.create(fixtureModelDto);
        this.logger.debug(`Tracked fixture model setup in fixtures_models with ID: ${newFixturesModelsEntity.id}`);
    }

    private async isAlreadySetup (fixture: IFixture): Promise<boolean> {
        // Calculate the checksum/hash of the fixture json - TODO
        const checksum = this.sha256HashService.compute(fixture, {
            normalization: 'canonical',
            encoding: 'hex',
        });
        // Compare with existing checksum/hash in the fixtures table - TODO
        const filterDto = {
            filters: {
                checksum: {
                    $eq: checksum,
                },
                status: {
                    $eq: FixtureStatus.APPLIED,
                }
            }
        };

        const existingFixture = await this.fixturesService.find(filterDto);
        if (existingFixture && existingFixture.records.length > 0) {
            return true;
        }
        return false;
    }
}
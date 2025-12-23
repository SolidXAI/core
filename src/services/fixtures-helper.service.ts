import { Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { ModelMetadataHelperService } from "src/helpers/model-metadata-helper.service";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";

interface Fixture {
    scenarioName: string;
    scenarioDescription: string;
    models: {
        singularName: string;
        data: unknown;
    }[];
}

// This service can contain common logic for fixtures setup and tear down
@Injectable()
export class FixturesHelperService {
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        private readonly moduleMetadataHelper: ModuleMetadataHelperService,
        private readonly modelMetadataHelper: ModelMetadataHelperService,
    ) { }

    async setupFixtures(moduleName: string, scenarioName: string) {
        // Load the scenario fixture from module metadata
        const scenarioFixture = await this.loadFixture(moduleName, scenarioName);


        
        const fixtureId = await this.initiateFixtureSetup();

        // For each model in the fixtures, load the appropriate model service and create the instance
        for (const modelFixture of scenarioFixture.models) {
            const modelServiceInstance = await this.modelMetadataHelper.loadModelService(modelFixture.singularName);
            try {
                // Create the model instance in the database
                const createdInstance = await modelServiceInstance.create(modelFixture.data);
                this.logger.debug(`Successfully created fixture for model: ${modelFixture.singularName} with ID: ${createdInstance.id}`);

                // Store the created instance details in the fixtures_models tracking table, with the createdInstance id - TODO
                await this.trackFixtureModelSetup(fixtureId, modelFixture.singularName, createdInstance.id);
            } catch (error) {
                throw new InternalServerErrorException(`Error creating fixture for scenario ${scenarioName} for model: ${modelFixture.singularName} - ${error.message}`);
            }
        }

        // Update the entry in the fixtures table with status 'completed' - TODO
        await this.completeFixtureSetup();
    }

    async tearDownFixtures(moduleName: string, scenarioName: string) {
        // Call delete on the modelService to remove the created fixtures, in reverse order
        const scenarioFixture = await this.loadFixture(moduleName, scenarioName);
        if (!scenarioFixture?.models || scenarioFixture.models.length === 0) {
            this.logger.warn(`No models found to tear down for scenario: ${scenarioName} in module: ${moduleName}`);
            return;
        }

        // For each model in reverse order
        for (const modelFixture of scenarioFixture.models.reverse()) {
            const modelServiceInstance = await this.modelMetadataHelper.loadModelService(modelFixture.singularName);

            // Get the user key field for the model to identify the created instances
            try {
                // Assuming we have some way to identify the created instances, e.g., by a unique field in data
                const deleteCriteria = modelFixture.data; // This should be adjusted based on actual criteria
                await modelServiceInstance.delete(deleteCriteria);
                this.logger.log(`Successfully deleted fixture for model: ${modelFixture.singularName}`);
            } catch (error) {
                this.logger.error(`Error deleting fixture for model: ${modelFixture.singularName} - ${error.message}`);
            }
        }

    }

    private async loadFixture(moduleName: string, scenarioName: string): Promise<Fixture> {
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
        const scenarioFixture = allFixtures.find((fixture: Fixture) => fixture.scenarioName === scenarioName);
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

    private async initiateFixtureSetup() {
        // Create the entry in the fixtures table with status 'in-progress' - TODO
        return 1; // return fixtureId - TODO
    }

    private async completeFixtureSetup() {
        // Update the entry in the fixtures table with status 'completed' - TODO
    }

    private async trackFixtureModelSetup (fixtureId: number, modelSingularName: string, createdInstanceId: number) {
        // Create entry in the fixtures_models tracking table - TODO
    }

    private async isAlreadySetup (fixture: Fixture): Promise<boolean> {
        // Calculate the checksum/hash of the fixture json - TODO
        // Compare with existing checksum/hash in the fixtures table - TODO
        // Check in the fixtures table if the given scenario for the module is already setup - TODO
        return false;
    }
}
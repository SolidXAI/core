import { Injectable, Logger } from "@nestjs/common";
import { SolidIntrospectService } from "./solid-introspect.service";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import { classify } from '../helpers/string.helper';

interface ScenarioFixture {
    name: string;
    models: {
        singularName: string;
        data: any;
    }[];
}

// This service can contain common logic for fixtures setup and tear down
@Injectable()
export class FixturesService {
    private readonly logger = new Logger(this.constructor.name);

    constructor(
        private readonly introspectService: SolidIntrospectService,
        private readonly moduleMetadataHelper: ModuleMetadataHelperService,
    ) { }

    async setupFixtures(moduleName: string, scenarioName: string) {
        const scenarioFixture = await this.loadScenario(moduleName, scenarioName);
        if (!scenarioFixture?.models || scenarioFixture.models.length === 0) {
            this.logger.warn(`No models found to setup for scenario: ${scenarioName} in module: ${moduleName}`);
            return;
        }

        // For each model in the fixtures, use introspectService to get model service
        for (const modelFixture of scenarioFixture.models) {
            const modelServiceInstance = await this.loadModelService(modelFixture.singularName);
            try {
                // Create the model instance in the database
                const createdInstance = await modelServiceInstance.create(modelFixture.data);
                this.logger.log(`Successfully created fixture for model: ${modelFixture.singularName} with ID: ${createdInstance.id}`);
            } catch (error: any) {
                this.logger.error(`Error creating fixture for model: ${modelFixture.singularName} - ${error.message}`);
            }
        }
    }

    async tearDownFixtures(moduleName: string, scenarioName: string) {
        // Call delete on the modelService to remove the created fixtures, in reverse order
        const scenarioFixture = await this.loadScenario(moduleName, scenarioName);
        if (!scenarioFixture?.models || scenarioFixture.models.length === 0) {
            this.logger.warn(`No models found to tear down for scenario: ${scenarioName} in module: ${moduleName}`);
            return;
        }

        // For each model in reverse order
        for (const modelFixture of scenarioFixture.models.reverse()) {
            const modelServiceInstance = await this.loadModelService(modelFixture.singularName);

            // Get the user key field for the model to identify the created instances
            try {
                // Assuming we have some way to identify the created instances, e.g., by a unique field in data
                const deleteCriteria = modelFixture.data; // This should be adjusted based on actual criteria
                await modelServiceInstance.delete(deleteCriteria);
                this.logger.log(`Successfully deleted fixture for model: ${modelFixture.singularName}`);
            } catch (error: any) {
                this.logger.error(`Error deleting fixture for model: ${modelFixture.singularName} - ${error.message}`);
            }
        }

    }

    private async loadScenario(moduleName: string, scenarioName: string): Promise<ScenarioFixture | undefined> {
        // Read the module metadata file based on module name
        const moduleMetadataConfiguration = await this.moduleMetadataHelper.getModuleMetadataConfiguration(
            await this.moduleMetadataHelper.getModuleMetadataFilePath(moduleName)
        );
        if (!moduleMetadataConfiguration) {
            this.logger.error(`No module metadata configuration found for module: ${moduleName}`);
            return;
        }
        this.logger.debug(`Module Metadata Configuration loaded for module: ${moduleName}`);

        // Read the fixtures json from above file
        const allFixtures = moduleMetadataConfiguration?.fixtures;
        this.logger.debug(`All Fixtures: ${JSON.stringify(allFixtures)}`);
        // Check if scenarios exists
        if (!allFixtures?.scenarios.length || allFixtures?.scenarios.length === 0) {
            this.logger.error(`No scenarios defined in the module metadata configuration for module: ${moduleName}`);
            return;
        }

        // Find the fixtures for the given scenario
        const scenarioFixture = allFixtures.scenarios.find((scenario: ScenarioFixture) => scenario.name === scenarioName);
        if (!scenarioFixture) {
            this.logger.error(`Scenario: ${scenarioName} not found in module metadata configuration for module: ${moduleName}`);
            return;
        }
        this.logger.log(`Scenario: ${scenarioName} found with fixtures to setup.`);
        return scenarioFixture;
    }

    private async loadModelService(singularName: string): Promise<any> {
        const modelServiceProvider = this.introspectService.getProvider(`${classify(singularName)}Service`);
        if (!modelServiceProvider) {
            this.logger.error(`Model service provider not found for model: ${singularName}`);
            return null;
        }
        this.logger.debug(`Model service provider found for model: ${singularName}`);
        return modelServiceProvider.instance;
    }
}
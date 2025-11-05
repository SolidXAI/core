import { Injectable, Logger } from "@nestjs/common";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { IMcpToolResponseHandler, McpComputedProviderResponse, PlanStep } from "../../../interfaces";
import { SolidTsMorphService } from "src/services/solid-ts-morph.service";
import { ModuleMetadataHelperService } from "src/helpers/module-metadata-helper.service";
import * as fs from "fs/promises";

const RESTART_TOUCH_FILE = process.env.MCP_RESTART_TOUCH_FILE || "tmp/restart.touch";

@Injectable()
export class SolidAddHeaderButtonOrRowButtonToListViewMcpHandler implements IMcpToolResponseHandler {
    private readonly logger = new Logger(SolidAddHeaderButtonOrRowButtonToListViewMcpHandler.name);

    constructor(
        private readonly tsMorph: SolidTsMorphService,
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,

    ) { }

    async apply(aiInteraction: AiInteraction) {
        const raw = this.safeParse(aiInteraction.message);
        const payload: McpComputedProviderResponse | undefined = (raw?.data?.plan ? raw.data : raw) as McpComputedProviderResponse;

        if (!payload || !Array.isArray(payload.plan)) {
            throw new Error("SolidAddHeaderButtonOrRowButtonToListViewMcpHandler: invalid MCP response; missing plan[]");
        }

        // Batch all plan steps in a single txn so nodemon restarts only once.
        this.tsMorph.begin();
        try {
            for (const step of payload.plan as PlanStep[]) {
                switch (step.type) {
                    case "createNewFile": {
                        const overwrite = step.overwrite ?? false;
                        this.tsMorph.createNewFile(step.path, step.content, overwrite);
                        break;
                    }
                    case "registerSolidXExtensionComponent": {
                        this.tsMorph.registerExtensionToSolidExtension(
                            step.path,
                            step.content,
                        );
                        this.tsMorph.addImportToSolidExtension(
                            step.path,
                            step.importExtensionComponent,
                        );
                        break;
                    }
                    case "addListViewButton": {

                        const filePath =
                            await this.moduleMetadataHelperService.getModuleMetadataFilePath(
                                step.moduleName
                            );
                        try {
                            await fs.access(filePath);
                        } catch {
                            this.logger.error(`Metadata file not found: ${filePath}`);
                            return;
                        }
                        const metaData =
                            await this.moduleMetadataHelperService.getModuleMetadataConfiguration(
                                filePath
                            );
                        // Remove, update or insert logic


                        // Find the existing view of type "list" for the given module & model
                        const existingViewIndex = metaData.views.findIndex(
                            (view: any) =>
                                view.type === "list" &&
                                view.moduleUserKey === step.moduleName &&
                                view.modelUserKey === step.modelName
                        );

                        if (existingViewIndex !== -1) {
                            const view = metaData.views[existingViewIndex];

                            // Ensure layout & attrs exist
                            view.layout = view.layout || {};
                            view.layout.attrs = view.layout.attrs || {};

                            // Initialize rowButtons or headerButtons if not present
                            if (!Array.isArray(view.layout.attrs[step.buttonType])) {
                                view.layout.attrs[step.buttonType] = [];
                            }

                            let buttonContent = step.content;

                            // Parse only if it’s a string
                            if (typeof buttonContent === "string") {
                                try {
                                    buttonContent = JSON.parse(buttonContent);
                                } catch (err) {
                                    this.logger.error("❌ Failed to parse step.content JSON:", err);
                                    return;
                                }
                            }


                            // Push the new button content
                            view.layout.attrs[step.buttonType].push(buttonContent);

                            console.log(`✅ Added ${step.buttonType} to view: ${view.name}`);
                        } else {
                            console.warn(`⚠️ No matching list view found for module=${step.moduleName} and model=${step.modelName}`);
                        }

                        const updatedContent = JSON.stringify(metaData, null, 2);
                        await fs.writeFile(filePath, updatedContent);
                        this.logger.log(`Updated list view in ${filePath}`);

                        break;
                    }
                    default:
                        throw new Error(`Unsupported plan step type: ${(step as any).type}`);
                }
            }

            const result = await this.tsMorph.commit();

            return {
                seedingRequired: true,
                serverRebooting: false,
            };
        } catch (err) {
            this.logger.error(`Apply failed; rolling back. ${String(err)}`);
            this.tsMorph.rollback();
            throw err;
        }
    }

    private safeParse(str: string): any {
        try {
            return JSON.parse(str);
        } catch {
            const unescaped = str.replace(/\\'/g, "'");
            return JSON.parse(unescaped);
        }
    }
}
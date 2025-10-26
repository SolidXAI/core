import { Injectable, Logger } from "@nestjs/common";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { IMcpToolResponseHandler, McpComputedProviderResponse, PlanStep } from "../../../interfaces";
import { SolidTsMorphService } from "src/services/solid-ts-morph.service";

const RESTART_TOUCH_FILE = process.env.MCP_RESTART_TOUCH_FILE || "tmp/restart.touch";

@Injectable()
export class SolidCreateComputedProviderMcpHandler implements IMcpToolResponseHandler {
  private readonly logger = new Logger(SolidCreateComputedProviderMcpHandler.name);

  constructor(private readonly tsMorph: SolidTsMorphService) { }

  async apply(aiInteraction: AiInteraction) {
    const raw = this.safeParse(aiInteraction.message);
    const payload: McpComputedProviderResponse | undefined = (raw?.data?.plan ? raw.data : raw) as McpComputedProviderResponse;

    if (!payload || !Array.isArray(payload.plan)) {
      throw new Error("SolidCreateComputedProviderMcpHandler: invalid MCP response; missing plan[]");
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
          case "registerNestProvider": {
            const uniqueGuard = step.uniqueGuard ?? true;
            this.tsMorph.registerNestProvider(
              step.modulePath,
              step.providerClassName,
              step.importFrom,
              step.registerIn,
              uniqueGuard,
            );
            break;
          }
          default:
            throw new Error(`Unsupported plan step type: ${(step as any).type}`);
        }
      }

      const result = await this.tsMorph.commit();

      return {
        seedingRequired: false,
        serverRebooting: false,
        appliedSteps: payload.plan.length,
        wroteFiles: result.wrote,
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
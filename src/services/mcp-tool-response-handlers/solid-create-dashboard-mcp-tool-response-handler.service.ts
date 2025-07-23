import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { CreateDashboardDto } from "src/dtos/create-dashboard.dto";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { IMcpToolResponseHandler } from "../../interfaces";
import { DashboardService } from "../dashboard.service";

@Injectable()
export class SolidCreateDashboardMcpToolResponseHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly dashboardService: DashboardService,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        const aiResponse = JSON.parse(aiInteraction.message);

        //FIXME: Replace \' with ' in the response, since the AI response seems to contain \' which is invalid JSON.
        // This is a workaround for now, until we find a better solution.
        const aiResponseMessageReplaced = aiResponse['message'].replace(/\\'/g, "'");

        const dashboardDto = plainToInstance(CreateDashboardDto, aiResponseMessageReplaced);

        const dashboard =  await this.dashboardService.create(dashboardDto, []);

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: false,
            serverRebooting: false,
        }
    }

}
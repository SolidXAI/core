import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { CreateDashboardVariableDto } from "src/dtos/create-dashboard-variable.dto";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { DashboardVariableService } from "src/services/dashboard-variable.service";
import { IMcpToolResponseHandler } from "../../../interfaces";

@Injectable()
export class SolidAddVariableToDashboardMcpHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly dashboardVariableService: DashboardVariableService,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        const escapedMessage = aiInteraction.message.replace(/\\'/g, "'");
        const aiResponseMessage = JSON.parse(escapedMessage);

        const {data} = aiResponseMessage;
        const { dashboardUserKey, schema} = data;

        //FIXME: Replace \' with ' in the response, since the AI response seems to contain \' which is invalid JSON.
        // This is a workaround for now, until we find a better solution.
        // const aiResponseMessageReplaced = aiResponseMessage['message'].replace(/\\'/g, "'");
        // const dashboardUserKey = aiResponseMessageReplaced['dashboardUserKey'];
        // if (!dashboardUserKey) {
        //     throw new Error("Dashboard User Key is required to create a Dashboard Question.");
        // }
        const dashboardVariableDto = plainToInstance(CreateDashboardVariableDto, schema);
        dashboardVariableDto['selectionStaticValues'] = JSON.stringify(dashboardVariableDto['selectionStaticValues'] || []);
        dashboardVariableDto['defaultValue'] = JSON.stringify(dashboardVariableDto['defaultValue'] || []);
        dashboardVariableDto['dashboardUserKey'] = dashboardUserKey;

        const dashboardVariable = await this.dashboardVariableService.create(dashboardVariableDto, []);

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: false,
            serverRebooting: false,
        }
    }

}
import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { CreateDashboardQuestionDto } from "src/dtos/create-dashboard-question.dto";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { IMcpToolResponseHandler } from "../../interfaces";
import { DashboardQuestionService } from "../dashboard-question.service";

@Injectable()
export class SolidCreateDashboardWidgetMcpToolResponseHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly dashboardQuestionService: DashboardQuestionService,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        const escapedMessage = aiInteraction.message.replace(/\\'/g, "'");
        const aiResponseMessage = JSON.parse(escapedMessage);

        //FIXME: Replace \' with ' in the response, since the AI response seems to contain \' which is invalid JSON.
        // This is a workaround for now, until we find a better solution.
        // const aiResponseMessageReplaced = aiResponseMessage['message'].replace(/\\'/g, "'");
        // const dashboardUserKey = aiResponseMessageReplaced['dashboardUserKey'];
        // if (!dashboardUserKey) {
        //     throw new Error("Dashboard User Key is required to create a Dashboard Question.");
        // }
        const dashboardQuestionDto = plainToInstance(CreateDashboardQuestionDto, aiResponseMessage);
        dashboardQuestionDto['questionSqlDatasetConfigsCommand'] = "update";

        const dashboardQuestion = await this.dashboardQuestionService.create(dashboardQuestionDto, []);

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: false,
            serverRebooting: false,
        }
    }

}
import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { IMcpToolResponseHandler } from "../../../interfaces";
import { DashboardQuestionSqlDatasetConfigService } from "../../dashboard-question-sql-dataset-config.service";
import { CreateDashboardQuestionSqlDatasetConfigDto } from "src/dtos/create-dashboard-question-sql-dataset-config.dto";

@Injectable()
export class SolidCreateDashboardQuestionSqlDatasetConfigMcpHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly dashboardQuestionSqlDatasetConfigService: DashboardQuestionSqlDatasetConfigService,
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        // const aiResponse = JSON.parse(aiInteraction.message);
        const escapedMessage = aiInteraction.message.replace(/\\'/g, "'");
        const aiResponseMessage = JSON.parse(escapedMessage);

        // FIXME: Replace \' with ' in the response, since the AI response seems to contain \' which is invalid JSON.
        // This is a workaround for now, until we find a better solution.
        // const aiResponseMessageReplaced = aiResponse['message'].replace(/\\'/g, "'");
        // const dashboardUserKey = aiResponseMessageReplaced['dashboardUserKey'];
        // if (!dashboardUserKey) {
        //     throw new Error("Dashboard User Key is required to create a Dashboard Question.");
        // }
        const dto = plainToInstance(CreateDashboardQuestionSqlDatasetConfigDto, aiResponseMessage);
        dto['options'] = JSON.stringify(dto['options']);

        const dashboardQuestion = await this.dashboardQuestionSqlDatasetConfigService.create(dto, []);

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: false,
            serverRebooting: false,
        }
    }

}
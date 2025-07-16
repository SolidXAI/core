import { DashboardQuestion } from "src/entities/dashboard-question.entity";
import { EntityManager } from "typeorm";

export async function getLabels(question: DashboardQuestion, entityManager: EntityManager): Promise<string[]> {
    const labelSql = question.labelSql;
    if (!labelSql) {
        return [];
    }    
    const labelResults = await this.entityManager.query(labelSql);
    // Assuming labelResults has a single row with a 'label' field
    // Map the label results to the labels array
    const labels: string[] = labelResults.map((result: { [x: string]: string; }) => result['label']);
    return labels;
}
import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Question } from 'src/entities/question.entity'

@Entity("ss_question_sql_dataset_config")
export class QuestionSqlDatasetConfig extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    datasetName: string;
    @Column({ type: "varchar" })
    datasetDisplayName: string;
    @Column({ type: "text", nullable: true })
    description: string;
    @Column({ type: "text" })
    sql: string;
    @Column({ type: "varchar" })
    labelColumnName: string;
    @Column({ type: "varchar" })
    valueColumnName: string;
    @ManyToOne(() => Question, { onDelete: "CASCADE", nullable: false })
    @JoinColumn()
    question: Question;
    @Column({ type: "text", nullable: true })
    options: any;
}
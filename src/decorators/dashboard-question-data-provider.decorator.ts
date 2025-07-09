export const IS_DASHBOARD_QUESTION_DATA_PROVIDER = 'IS_DASHBOARD_QUESTION_DATA_PROVIDER';

export const DashboardQuestionDataProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_DASHBOARD_QUESTION_DATA_PROVIDER, true, target);
    };
};
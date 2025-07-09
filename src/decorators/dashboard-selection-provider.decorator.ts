export const IS_DASHBOARD_VARIABLE_SELECTION_PROVIDER = 'IS_DASHBOARD_VARIABLE_SELECTION_PROVIDER';

export const DashboardVariableSelectionProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_DASHBOARD_VARIABLE_SELECTION_PROVIDER, true, target);
    };
};
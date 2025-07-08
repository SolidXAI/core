export const IS_DASHBOARD_SELECTION_PROVIDER = 'IS_DASHBOARD_SELECTION_PROVIDER';

export const DashboardSelectionProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_DASHBOARD_SELECTION_PROVIDER, true, target);
    };
};
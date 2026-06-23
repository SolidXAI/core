import { SetMetadata } from "@nestjs/common";

export const IS_DASHBOARD_WIDGET_DATA_PROVIDER = "IS_DASHBOARD_WIDGET_DATA_PROVIDER";

export const DashboardWidgetDataProvider = () => SetMetadata(IS_DASHBOARD_WIDGET_DATA_PROVIDER, true);


import { BasicFilterDto } from "./basic-filters.dto";

export interface SecurityRuleConfig {
    filters: Record<string, any>;
}
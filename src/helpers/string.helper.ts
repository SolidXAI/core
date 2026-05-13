export const lowerFirst = (str: string): string => {
    if (!str) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
}

import { upperFirst, camelCase } from 'lodash';
export const classify = (s: string): string => upperFirst(camelCase(s));

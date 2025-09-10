export const lowerFirst = (str: string): string => {
    if (!str) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
}

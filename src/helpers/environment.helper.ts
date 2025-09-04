export function parseBooleanEnv(key: string, defaultValue: boolean = false): boolean {
    const value = process.env[key];
    if (value === undefined) {
        return defaultValue;
    }
    return value.toLowerCase() === 'true';
}
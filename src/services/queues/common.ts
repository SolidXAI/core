/**
 * Convert a string into a lower-case slug separated by a join character.
 *
 * Logic:
 * - Keep only ASCII letters and digits.
 * - Convert A-Z to a-z.
 * - Replace runs of non-alphanumeric characters with a single join character.
 * - Trim leading/trailing join characters.
 *
 * Examples (joinChar "_"):
 * - "Venue App" -> "venue_app"
 * - "My-App@2025" -> "my_app_2025"
 * - "  CORE__API!! " -> "core_api"
 *
 * Examples (joinChar "-"):
 * - "Venue App" -> "venue-app"
 */
export function toSlug(value?: string | null, joinChar: string = '-'): string {
    if (!value) {
        return '';
    }

    const slugChars: string[] = [];
    let lastJoin = true;

    for (let i = 0; i < value.length; i += 1) {
        const code = value.charCodeAt(i);

        if (code >= 65 && code <= 90) {
            slugChars.push(String.fromCharCode(code + 32));
            lastJoin = false;
            continue;
        }

        if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
            slugChars.push(value[i]);
            lastJoin = false;
            continue;
        }

        if (!lastJoin && slugChars.length > 0) {
            slugChars.push(joinChar);
            lastJoin = true;
        }
    }

    if (slugChars.length && slugChars[slugChars.length - 1] === joinChar) {
        slugChars.pop();
    }

    return slugChars.join('');
}

/**
 * Build a namespaced queue name by prefixing the queue name with the
 * slugged app name, the slugged env, and underscores.
 *
 * Examples:
 * - appName "Venue App", env "Prod", queue "orders" -> "venue_app_prod_orders"
 * - appName "core-api", env "staging", queue "sync" -> "core_api_staging_sync"
 * - appName "" or undefined, env "" or undefined, queue "jobs" -> "_dev_jobs"
 */
export function buildNamespacedQueueName(
    queueName: string,
    appName: string | undefined | null = process.env.SOLID_APP_NAME,
    env: string | undefined | null = process.env.ENV,
): string {
    const appNameSlug = toSlug(appName, '_');
    const envValue = env && env.length > 0 ? env : (process.env.ENV && process.env.ENV.length > 0 ? process.env.ENV : 'dev');
    const envSlug = toSlug(envValue, '_');
    return `${appNameSlug}_${envSlug}_${queueName}`;
}

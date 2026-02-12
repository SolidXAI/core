/**
 * Convert an app name into a lower-case, underscore-separated slug.
 *
 * Logic:
 * - Keep only ASCII letters and digits.
 * - Convert A-Z to a-z.
 * - Replace runs of non-alphanumeric characters with a single underscore.
 * - Trim leading/trailing underscores.
 *
 * Examples:
 * - "Venue App" -> "venue_app"
 * - "My-App@2025" -> "my_app_2025"
 * - "  CORE__API!! " -> "core_api"
 */
export function toAppNameSlug(appName?: string | null): string {
    if (!appName) {
        return '';
    }

    const slugChars: string[] = [];
    let lastUnderscore = true;

    for (let i = 0; i < appName.length; i += 1) {
        const code = appName.charCodeAt(i);

        if (code >= 65 && code <= 90) {
            slugChars.push(String.fromCharCode(code + 32));
            lastUnderscore = false;
            continue;
        }

        if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
            slugChars.push(appName[i]);
            lastUnderscore = false;
            continue;
        }

        if (!lastUnderscore && slugChars.length > 0) {
            slugChars.push('_');
            lastUnderscore = true;
        }
    }

    if (slugChars.length && slugChars[slugChars.length - 1] === '_') {
        slugChars.pop();
    }

    return slugChars.join('');
}

/**
 * Build a namespaced queue name by prefixing the queue name with the
 * slugged app name and an underscore.
 *
 * Examples:
 * - appName "Venue App", queue "orders" -> "venue_app_orders"
 * - appName "core-api", queue "sync" -> "core_api_sync"
 * - appName "" or undefined, queue "jobs" -> "_jobs"
 */
export function buildNamespacedQueueName(queueName: string, appName: string | undefined | null = process.env.SOLID_APP_NAME): string {
    const appNameSlug = toAppNameSlug(appName);
    return `${appNameSlug}_${queueName}`;
}

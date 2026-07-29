// Some filter/sort DTOs arrive with bracket-wrapped keys (e.g. "[isPublished]") from
// query-string parsing. Both CrudHelperService and DraftPublishHelperService need to
// strip that wrapping before reading keys, so it lives here as a shared utility.
export function normalizeObjectKeys(obj: any): any {
    return Object.keys(obj).reduce((acc, key) => {
        const newKey = key.replace(/^\[(.*)\]$/, '$1');
        acc[newKey] = obj[key];
        return acc;
    }, {});
}

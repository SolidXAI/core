export function shouldUseCache(): boolean {
  // CLI commands such as `solidctl seed` run in a short-lived process and may
  // perform multiple reads around an insert/update. Avoid stale repository
  // cache entries (especially cached negative lookups) during those commands.
  if ((process.env.SOLID_CLI_RUNNING ?? '').toLowerCase() === 'true') {
    return false;
  }

  const env = (process.env.ENV ?? process.env.NODE_ENV ?? '').toLowerCase();
  return env === 'prod' || env === 'production';
}

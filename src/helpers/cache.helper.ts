export function shouldUseCache(): boolean {
  const env = (process.env.ENV ?? process.env.NODE_ENV ?? '').toLowerCase();
  return env === 'prod' || env === 'production';
}


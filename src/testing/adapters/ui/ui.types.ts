export interface PlaywrightAdapterOptions {
  headless?: boolean;
  baseUrl?: string;
  mobile?: boolean;
  viewport?: { width: number; height: number };
}

import fs from "fs";
import path from "path";

/**
 * Backend theme registry.
 *
 * Responsibilities:
 * - discover theme folders from the filesystem
 * - classify each theme as light/dark from its key
 * - expose default and grouped theme helpers for backend settings
 *
 * Shared pure parsing helpers are intentionally mirrored in solid-core-ui,
 * but all filesystem discovery stays here.
 */
export type ThemeMode = "light" | "dark";

export type AppThemeDefinition = {
  key: string;
  label: string;
  mode: ThemeMode;
  default?: boolean;
};

const DEFAULT_THEME_KEYS: Record<ThemeMode, string> = {
  light: "solid-light-purple",
  dark: "solid-dark-purple",
};

const THEME_MODE_TOKENS: Record<ThemeMode, string> = {
  light: "-light-",
  dark: "-dark-",
};

const THEME_MODE_SUFFIXES: Record<ThemeMode, string> = {
  light: "-light",
  dark: "-dark",
};

function normalizeThemeKey(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function matchesThemeMode(value: string, mode: ThemeMode): boolean {
  return (
    value.includes(THEME_MODE_TOKENS[mode])
    || value.endsWith(THEME_MODE_SUFFIXES[mode])
    || value === mode
  );
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => {
      if (token.toLowerCase() === "solid") return "SolidX";
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ");
}

export function getThemeModeFromThemeKey(value?: string | null): ThemeMode | null {
  const normalized = normalizeThemeKey(value);
  if (!normalized) return null;

  if (matchesThemeMode(normalized, "light")) return "light";
  if (matchesThemeMode(normalized, "dark")) return "dark";

  return null;
}

function createThemeDefinition(key: string, defaultTheme = false): AppThemeDefinition {
  const mode = getThemeModeFromThemeKey(key);
  if (!mode) {
    throw new Error(`Invalid theme key: ${key}`);
  }

  return {
    key,
    label: titleCase(key),
    mode,
    default: defaultTheme,
  };
}

function createDefaultTheme(mode: ThemeMode): AppThemeDefinition {
  return createThemeDefinition(DEFAULT_THEME_KEYS[mode], true);
}

function groupThemesByMode(themes: AppThemeDefinition[], mode: ThemeMode): AppThemeDefinition[] {
  return themes.filter((theme) => theme.mode === mode);
}

function pickDefaultThemeKey(themes: AppThemeDefinition[], mode: ThemeMode): string {
  const themesForMode = groupThemesByMode(themes, mode);

  return (
    themesForMode.find((theme) => theme.default)?.key
    ?? themesForMode[0]?.key
    ?? DEFAULT_THEME_KEYS[mode]
  );
}

function resolveThemeDirectory(): string | null {
  const configuredDirectory = process.env.SOLID_THEME_DIRECTORY?.trim() || process.env.SOLIDX_THEME_DIRECTORY?.trim();
  const fallbackDirectory = path.resolve(process.cwd(), "..", "solid-ui", "public", "themes");
  const candidateDirectory = configuredDirectory || fallbackDirectory;

  try {
    if (fs.existsSync(candidateDirectory) && fs.statSync(candidateDirectory).isDirectory()) {
      return path.resolve(candidateDirectory);
    }
  } catch {
    return null;
  }

  return null;
}

function isThemeDirectory(themeDirectory: string, entryName: string): boolean {
  return fs.existsSync(path.join(themeDirectory, entryName, "theme.css"));
}

function readThemesFromPath(): AppThemeDefinition[] {
  const themeDirectory = resolveThemeDirectory();
  if (!themeDirectory) {
    return [];
  }

  try {
    const directoryEntries = fs.readdirSync(themeDirectory, { withFileTypes: true });

    return directoryEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name.trim())
      .filter(Boolean)
      .filter((entryName) => isThemeDirectory(themeDirectory, entryName))
      .flatMap((entryName) => {
        const mode = getThemeModeFromThemeKey(entryName);
        if (!mode) return [];

        return [createThemeDefinition(entryName, entryName === DEFAULT_THEME_KEYS[mode])];
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  } catch {
    return [];
  }
}

function getThemes(): AppThemeDefinition[] {
  const discoveredThemes = readThemesFromPath();

  if (discoveredThemes.length) {
    return discoveredThemes;
  }

  return [createDefaultTheme("light"), createDefaultTheme("dark")];
}

export function getCoreThemes(): AppThemeDefinition[] {
  return getThemes();
}

export function registerAppThemes(_themes: AppThemeDefinition[] = []): void {
  // Theme registration is now path-based. Keep this as a no-op for backwards compatibility.
}

export function getRegisteredThemes(): AppThemeDefinition[] {
  return getThemes();
}

export function getThemesByMode(mode: ThemeMode): AppThemeDefinition[] {
  return groupThemesByMode(getRegisteredThemes(), mode);
}

export function getDefaultThemeKey(mode: ThemeMode = "light"): string {
  return pickDefaultThemeKey(getRegisteredThemes(), mode);
}

export function isRegisteredThemeKey(value?: string | null, mode?: ThemeMode): value is string {
  if (!value) return false;

  return getRegisteredThemes().some((theme) => {
    if (theme.key !== value) return false;
    return mode ? theme.mode === mode : true;
  });
}

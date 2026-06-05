import { Logger } from '@nestjs/common';
import * as fs from 'fs'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths

const logger = new Logger('module.helper');

export const getDynamicModuleNames = (): string[] => {
  const dynamicModulesToExclude = process.env.SOLID_DYNAMIC_MODULES_TO_EXCLUDE?.split(',') || [];

  // Adjust if 'src' is in a different location
  const srcPath = path.join(process.cwd(), 'src');
  const coreModuleNames = getCoreModuleNames();
  const allExcludedModules = [...new Set([...coreModuleNames, ...dynamicModulesToExclude])];

  const directories = fs.readdirSync(srcPath, { withFileTypes: true });
  // const enabledModules = directories
  //   .filter(d => d.isDirectory() && !allExcludedModules.includes(d.name))
  //   .map(d => d.name);

  const enabledModules = directories
    .filter(dirent => {
      const isValidDirectory = dirent.isDirectory() && !allExcludedModules.includes(dirent.name);

      if (!isValidDirectory) return false;

      const moduleManifestPath = path.join(srcPath, dirent.name, `${dirent.name}.module.ts`);
      const stats = fs.statSync(moduleManifestPath, { throwIfNoEntry: false });
      return !!stats && stats.isFile();
    })
    .map(dirent => dirent.name);

  // logger.debug(`Enabled dynamic modules:`, enabledModules);
  // console.log(`Dynamic Modules Are:`, enabledModules);

  return enabledModules;
}

export const getDynamicModuleNamesBasedOnMetadata = (): string[] => {
  const dynamicModulesToExclude = process.env.SOLID_DYNAMIC_MODULES_TO_EXCLUDE?.split(',') || [];

  const srcPath = path.join(process.cwd(), 'src');
  const coreModuleNames = getCoreModuleNames();
  const allExcludedModules = [...new Set([...coreModuleNames, ...dynamicModulesToExclude])];

  if (!fs.existsSync(srcPath)) {
    logger.warn(`Source path does not exist: ${srcPath}`);
    return [];
  }

  const moduleDirectories = fs.readdirSync(srcPath, { withFileTypes: true });
  const enabledModules = moduleDirectories
    .filter(dirent => {
      const isValidDirectory = dirent.isDirectory() && !allExcludedModules.includes(dirent.name);

      if (!isValidDirectory) return false;

      const moduleManifestPath = path.join(srcPath, dirent.name, `${dirent.name}.module.ts`);
      const moduleManifestStats = fs.statSync(moduleManifestPath, { throwIfNoEntry: false });
      if (!moduleManifestStats || !moduleManifestStats.isFile()) {
        return false;
      }

      const fullPath = path.join(srcPath, dirent.name, 'metadata', `${dirent.name}-metadata.json`);

      const stats = fs.statSync(fullPath, { throwIfNoEntry: false });
      return !!stats && stats.isFile();
    })
    .map(dirent => dirent.name);

  // logger.debug(`Enabled dynamic modules basis src:`, enabledModules);
  // console.log(`Src Based Dynamic Modules Are:`, enabledModules);
  return enabledModules;
}

export const getCoreModuleNames = (): string[] => {
  // return ['iam', 'common', 'queues', 'app-builder'];
  return ['solid-core'];
}

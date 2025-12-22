import * as fs from 'fs'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths


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

      // return true
      const fullPath = path.join(srcPath, dirent.name);
      const files = fs.readdirSync(fullPath);
      // skip if empty directory
      return files.length > 0;
    })
    .map(dirent => dirent.name);

  console.log(`Enabled dynamic modules:`, enabledModules);
  return enabledModules;
}

export const getDynamicModuleNamesBasedOnMetadata = (): string[] => {
  const dynamicModulesToExclude = process.env.SOLID_DYNAMIC_MODULES_TO_EXCLUDE?.split(',') || [];

  // Find a path that is ../${srcPath}/module-metadata save it in a variable.
  // const srcPath = path.join(process.cwd(), 'src');
  const moduleMetadataPath = path.join(process.cwd(), 'module-metadata');
  const coreModuleNames = getCoreModuleNames();
  const allExcludedModules = [...new Set([...coreModuleNames, ...dynamicModulesToExclude])];

  const moduleMetadataDirectories = fs.readdirSync(moduleMetadataPath, { withFileTypes: true });
  const enabledModules = moduleMetadataDirectories
    .filter(dirent => {
      const isValidDirectory = dirent.isDirectory() && !allExcludedModules.includes(dirent.name);

      if (!isValidDirectory) return false;

      const fullPath = path.join(moduleMetadataPath, dirent.name, `${dirent.name}-metadata.json`);

      const stats = fs.statSync(fullPath, { throwIfNoEntry: false });
      return !!stats && stats.isFile();
    })
    .map(dirent => dirent.name);

  console.log(`Enabled dynamic modules basis src:`, enabledModules);
  return enabledModules;
}

export const getCoreModuleNames = (): string[] => {
  // return ['iam', 'common', 'queues', 'app-builder'];
  return ['solid-core'];
}
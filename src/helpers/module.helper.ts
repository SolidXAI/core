import * as fs from 'fs'; // Use the Promise-based version of fs for async/await
import * as path from 'path'; // To handle file paths


export const getDynamicModuleNames = (): string[] => {
    const dynamicModulesToExclude = process.env.SOLID_DYNAMIC_MODULES_TO_EXCLUDE?.split(',') || [];
  
    // Adjust if 'src' is in a different location
    const srcPath = path.join(process.cwd(), 'src');
    const coreModuleNames = getCoreModuleNames();
    const allExcludedModules = [...new Set([...coreModuleNames, ...dynamicModulesToExclude])];
  
    const directories = fs.readdirSync(srcPath, { withFileTypes: true });
    const enabledModules = directories
      .filter(d => d.isDirectory() && !allExcludedModules.includes(d.name))
      .map(d => d.name);
  
    console.log(`Enabled dynamic modules:`, enabledModules);
    return enabledModules;
  }
  
  export const getCoreModuleNames = (): string[] => {
    // return ['iam', 'common', 'queues', 'app-builder'];
    return ['solid-core'];
  }
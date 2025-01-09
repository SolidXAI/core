"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCoreModuleNames = exports.getDynamicModuleNames = void 0;
const fs = require("fs");
const path = require("path");
const getDynamicModuleNames = () => {
    const dynamicModulesToExclude = process.env.SOLID_DYNAMIC_MODULES_TO_EXCLUDE?.split(',') || [];
    const srcPath = path.join(process.cwd(), 'src');
    const coreModuleNames = (0, exports.getCoreModuleNames)();
    const allExcludedModules = [...new Set([...coreModuleNames, ...dynamicModulesToExclude])];
    const directories = fs.readdirSync(srcPath, { withFileTypes: true });
    const enabledModules = directories
        .filter(d => d.isDirectory() && !allExcludedModules.includes(d.name))
        .map(d => d.name);
    console.log(`Enabled dynamic modules:`, enabledModules);
    return enabledModules;
};
exports.getDynamicModuleNames = getDynamicModuleNames;
const getCoreModuleNames = () => {
    return ['solid-core'];
};
exports.getCoreModuleNames = getCoreModuleNames;
//# sourceMappingURL=module.helper.js.map
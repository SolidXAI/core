import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface PackageVersionInfo {
    repo: 'local' | 'npm';
    version: string;
}

export interface SolidVersionsInfo {
    'solid-core': PackageVersionInfo;
    'solid-core-ui': PackageVersionInfo;
    'solid-code-builder': PackageVersionInfo;
}

@Injectable()
export class InfoService {
    private readonly logger = new Logger(InfoService.name);

    getPackageVersions(): SolidVersionsInfo {
        return {
            'solid-core': this.getPackageInfo('@solidxai/core'),
            'solid-core-ui': this.getPackageInfo('@solidxai/core-ui'),
            'solid-code-builder': this.getPackageInfo('@solidxai/code-builder'),
        };
    }

    private getPackageInfo(packageName: string): PackageVersionInfo {
        const result = this.resolvePackageJson(packageName);
        if (result) return result;

        const siblingUiPath = path.resolve(process.cwd(), '..', 'solid-ui', 'node_modules', packageName, 'package.json');
        const siblingResult = this.readPackageJson(siblingUiPath);
        if (siblingResult) return siblingResult;

        this.logger.warn(`Could not resolve package: ${packageName}`);
        return { repo: 'npm', version: 'not installed' };
    }

    private resolvePackageJson(packageName: string): PackageVersionInfo | null {
        try {
            const pkgJsonPath = require.resolve(`${packageName}/package.json`);
            return this.readPackageJson(pkgJsonPath);
        } catch {
            return null;
        }
    }

    private readPackageJson(pkgJsonPath: string): PackageVersionInfo | null {
        try {
            if (!fs.existsSync(pkgJsonPath)) return null;
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            const version = pkgJson.version ? `v${pkgJson.version}` : 'unknown';
            const repo = pkgJsonPath.includes(path.sep + 'node_modules' + path.sep) ? 'npm' : 'local';
            return { repo, version };
        } catch {
            return null;
        }
    }
}

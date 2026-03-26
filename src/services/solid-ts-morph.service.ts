// src/ai/services/solid-ts-morph.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { join, dirname, normalize, isAbsolute, basename } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Project, Node, ObjectLiteralExpression, ArrayLiteralExpression, QuoteKind, IndentationText } from "ts-morph";
import { MethodDeclarationStructure, StructureKind } from "ts-morph";

type Bucket = "providers" | "exports";

// interface SolidTsMorphOptions {
//     /** Absolute path to monorepo root. Defaults to auto-detect or ENV. */
//     repoRoot?: string;
//     /** Map of workspace prefixes to absolute directories. Defaults for solid-api / solid-ui. */
//     workspaceMap?: Record<string, string>;
// }

@Injectable()
export class SolidTsMorphService {
    private readonly logger = new Logger(SolidTsMorphService.name);
    private project: Project;

    // transaction state
    private inTxn = false;
    private stagedWrites = new Map<string, { content: string; overwrite: boolean }>(); // absPath -> write
    private dirtySourceFiles = new Set<string>(); // absPath

    // path roots
    private readonly repoRoot: string;
    private readonly workspaceMap: Record<string, string>;

    // constructor(opts: SolidTsMorphOptions = {}) {
    constructor() {
        // this.repoRoot = this.discoverRepoRoot(opts.repoRoot);
        this.repoRoot = this.discoverRepoRoot();
        this.workspaceMap = {
            "solid-api": join(this.repoRoot, "solid-api"),
            "solid-ui": join(this.repoRoot, "solid-ui"),
            // ...(opts.workspaceMap ?? {}),
        };

        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
            manipulationSettings: {
                quoteKind: QuoteKind.Double,
                indentationText: IndentationText.FourSpaces,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            },
        });

        this.logger.debug(`SolidTsMorphService repoRoot = ${this.repoRoot}`);
        Object.entries(this.workspaceMap).forEach(([k, v]) => this.logger.debug(`workspace '${k}' => ${v}`));
    }

    // ---- repo-root discovery ----
    private discoverRepoRoot(): string {
        // if (input && isAbsolute(input)) return normalize(input);

        // ENV override
        const envRoot = process.env.SOLID_REPO_ROOT;
        if (envRoot && isAbsolute(envRoot)) return normalize(envRoot);

        // Auto-detect: if current cwd is a workspace (solid-api/solid-ui), then repoRoot = parent(cwd)
        const cwd = normalize(process.cwd());
        const base = basename(cwd);
        if (base === "solid-api" || base === "solid-ui") {
            return normalize(dirname(cwd));
        }

        // Otherwise assume cwd itself is the repo root
        return cwd;
    }

    /** Resolve a repo-relative path with optional workspace prefix (e.g. 'solid-api/...', 'solid-ui/...'). */
    private resolveRepoPath(relPath: string): string {
        if (!relPath) throw new Error("resolveRepoPath: empty path");
        const p = normalize(relPath);

        if (isAbsolute(p)) return p;

        // Prefix-aware mapping: 'solid-api/...', 'solid-ui/...'
        for (const [prefix, root] of Object.entries(this.workspaceMap)) {
            if (p === prefix || p.startsWith(prefix + "/") || p.startsWith(prefix + "\\")) {
                const suffix = p.slice(prefix.length + (p.length > prefix.length ? 1 : 0));
                return normalize(join(root, suffix));
            }
        }

        // Default: treat as repo-root relative
        return normalize(join(this.repoRoot, p));
    }

    private rel(abs: string): string {
        const root = this.repoRoot.replace(/\\/g, "/");
        return abs.replace(/\\/g, "/").replace(root + "/", "");
    }

    // ---- transaction API ----
    begin(): void {
        if (this.inTxn) {
            this.logger.warn("begin(): already in a transaction; reusing current transaction.");
            return;
        }
        this.inTxn = true;
        this.stagedWrites.clear();
        this.dirtySourceFiles.clear();
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
            manipulationSettings: {
                quoteKind: QuoteKind.Double,
                indentationText: IndentationText.FourSpaces,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            },
        });
        this.logger.log("Transaction started.");
    }

    rollback(): void {
        if (!this.inTxn) return;
        this.inTxn = false;
        this.stagedWrites.clear();
        this.dirtySourceFiles.clear();
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
            manipulationSettings: {
                quoteKind: QuoteKind.Double,
                indentationText: IndentationText.FourSpaces,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            },
        });
        this.logger.log("Transaction rolled back.");
    }

    async commit(): Promise<{ wrote: number }> {
        if (!this.inTxn) {
            this.logger.log("commit(): not in a transaction; nothing to commit.");
            return { wrote: 0 };
        }

        let writes = 0;

        // 1) write staged new/overwritten files
        for (const [abs, { content, overwrite }] of this.stagedWrites.entries()) {
            const dir = dirname(abs);
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            if (existsSync(abs) && !overwrite) {
                this.logger.log(`createNewFile (staged): skipped (exists) ${this.rel(abs)}`);
            } else {
                writeFileSync(abs, content, "utf8");
                writes++;
                this.logger.log(`${existsSync(abs) && overwrite ? "Overwrote" : "Created"} file: ${this.rel(abs)}`);
            }
        }

        // 2) save all mutated module files once
        for (const abs of this.dirtySourceFiles.values()) {
            const sf = this.project.getSourceFile(abs);
            if (!sf) continue;
            sf.fixMissingImports();
            sf.organizeImports();
            await sf.save();
            writes++;
            this.logger.log(`Updated module: ${this.rel(abs)}`);
        }

        // end txn
        this.inTxn = false;
        this.stagedWrites.clear();
        this.dirtySourceFiles.clear();
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
            manipulationSettings: {
                quoteKind: QuoteKind.Double,
                indentationText: IndentationText.FourSpaces,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            },
        });

        return { wrote: writes };
    }

    // ---- operations ----
    createNewFile(path: string, content: string, overwrite = false): { createdOrStaged: boolean; skipped: boolean } {
        const abs = this.resolveRepoPath(path);
        const dir = dirname(abs);

        if (this.inTxn) {
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            this.stagedWrites.set(abs, { content, overwrite });
            this.logger.log(`Staged createNewFile: ${this.rel(abs)} (overwrite=${overwrite})`);
            return { createdOrStaged: true, skipped: false };
        }

        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        if (existsSync(abs) && !overwrite) {
            this.logger.log(`createNewFile: skipped (exists): ${path}`);
            return { createdOrStaged: false, skipped: true };
        }
        writeFileSync(abs, content, "utf8");
        this.logger.log(`${existsSync(abs) && overwrite ? "Overwrote" : "Created"} file: ${path}`);
        return { createdOrStaged: true, skipped: false };
    }

    registerNestProvider(
        modulePath: string,
        providerClassName: string,
        importFrom: string,
        registerIn: Array<Bucket>,
        uniqueGuard = true
    ): { staged: boolean } {
        const abs = this.resolveRepoPath(modulePath);
        if (!existsSync(abs)) throw new Error(`registerNestProvider: module file not found at ${modulePath}`);

        const existing = this.project.getSourceFile(abs);
        const sourceFile = existing
            ? existing
            : this.project.createSourceFile(abs, readFileSync(abs, "utf8"), { overwrite: true });

        // ensure import
        const imp = sourceFile.getImportDeclarations().find(d => d.getModuleSpecifierValue() === importFrom);
        if (imp) {
            const has = imp.getNamedImports().some(ni => ni.getName() === providerClassName);
            if (!has) imp.addNamedImport(providerClassName);
        } else {
            sourceFile.addImportDeclaration({ moduleSpecifier: importFrom, namedImports: [providerClassName] });
        }

        // mutate @Module metadata
        const nestModuleClass = sourceFile.getClasses().find(cls =>
            cls.getDecorators().some(dec => dec.getName() === "Module")
        );
        if (!nestModuleClass) throw new Error(`registerNestProvider: No @Module() class found in ${modulePath}`);

        const moduleDec = nestModuleClass.getDecorators().find(dec => dec.getName() === "Module");
        const callExpr = moduleDec!.getCallExpression();
        const arg0 = callExpr?.getArguments()[0];
        if (!arg0 || !Node.isObjectLiteralExpression(arg0)) {
            throw new Error(`registerNestProvider: Malformed @Module() in ${modulePath}`);
        }
        const meta = arg0 as ObjectLiteralExpression;

        const ensureInArray = (propName: Bucket) => {
            let prop = meta.getProperty(propName);
            if (!prop) {
                meta.addPropertyAssignment({ name: propName, initializer: "[]" });
                prop = meta.getProperty(propName);
            }
            let arr: ArrayLiteralExpression | undefined;
            if (Node.isPropertyAssignment(prop)) {
                const init = prop.getInitializer();
                if (init && Node.isArrayLiteralExpression(init)) arr = init;
            }
            if (!arr) throw new Error(`registerNestProvider: Property ${propName} is not an array in ${modulePath}`);

            const exists = arr.getElements().some(el => el.getText().replace(/\s/g, "") === providerClassName);
            if (!exists || !uniqueGuard) arr.addElement(providerClassName);
        };

        for (const bucket of registerIn) ensureInArray(bucket);

        this.dirtySourceFiles.add(abs); // defer save to commit()
        this.logger.log(`Staged provider registration in: ${this.rel(abs)} (${registerIn.join(", ")})`);
        return { staged: true };
    }


    addMethodToExistingClass(
        filePath: string,
        className: string,
        methodName: string,
        methodCode: string,
    ): { staged: boolean; overwritten: boolean; skipped: boolean } {
        const abs = this.resolveRepoPath(filePath);
        if (!existsSync(abs))
            throw new Error(`addMethodToExistingClass: File not found at ${filePath}`);

        const existing = this.project.getSourceFile(abs);
        const sourceFile = existing
            ? existing
            : this.project.createSourceFile(abs, readFileSync(abs, "utf8"), { overwrite: true });

        const targetClass = sourceFile.getClass(className);
        if (!targetClass)
            throw new Error(`addMethodToExistingClass: Class ${className} not found in ${filePath}`);

        const existingMethod = targetClass.getMethod(methodName);
        if (existingMethod) {

            this.logger.log(`Skipped adding method '${methodName}' (already exists)`);
            return { staged: false, overwritten: false, skipped: true };
        }
        // Add the LLM-generated method directly
        targetClass.addMember(methodCode);


        this.dirtySourceFiles.add(abs);
        this.logger.log(`Staged method '${methodName}' in class ${className} at ${this.rel(abs)}`);
        return { staged: true, overwritten: !!existingMethod, skipped: false };
    }

    registerSolidUiExtension(
        filePath: string,
        lineToAdd: string
    ): { staged: boolean; overwritten: boolean; skipped: boolean } {
        const abs = this.resolveRepoPath(filePath);
        if (!existsSync(abs))
            throw new Error(`registerSolidUiExtension: File not found at ${filePath}`);

        const fileContent = readFileSync(abs, "utf8");

        // Check if the line already exists (avoid duplicates)
        if (fileContent.includes(lineToAdd.trim())) {
            this.logger.log(`Skipped adding line (already exists): ${lineToAdd}`);
            return { staged: false, overwritten: false, skipped: true };
        }

        // Append the new line at the end, ensuring newline
        const newContent = fileContent.trimEnd() + "\n" + lineToAdd.trim() + "\n";

        // Write updated content back
        writeFileSync(abs, newContent, "utf8");

        this.dirtySourceFiles.add(abs);
        this.logger.log(`Staged new line in ${this.rel(abs)}: ${lineToAdd}`);
        return { staged: true, overwritten: false, skipped: false };
    }


    //Removes all import declarations from a file whose module specifier matches the given predicate.
    //Returns the set of identifier names that were imported by the removed declarations.
    removeImports(
        filePath: string,
        filter: (moduleSpecifier: string) => boolean
    ): { removedIdentifiers: Set<string>; staged: boolean; skipped: boolean } {
        const abs = this.resolveRepoPath(filePath);
        if (!existsSync(abs)) {
            this.logger.warn(`removeImport: file not found at ${filePath}, skipping.`);
            return { removedIdentifiers: new Set(), staged: false, skipped: true };
        }

        const existing = this.project.getSourceFile(abs);
        const sourceFile = existing
            ? existing
            : this.project.createSourceFile(abs, readFileSync(abs, "utf8"), { overwrite: true });

        const importsToRemove = sourceFile.getImportDeclarations().filter(decl => {
            const spec = decl.getModuleSpecifierValue().replace(/\\/g, "/");
            return filter(spec);
        });

        if (importsToRemove.length === 0) {
            return { removedIdentifiers: new Set(), staged: false, skipped: true };
        }

        const removedIdentifiers = new Set<string>();
        for (const decl of importsToRemove) {
            for (const named of decl.getNamedImports()) {
                removedIdentifiers.add(named.getAliasNode()?.getText() ?? named.getName());
            }
            const defaultImport = decl.getDefaultImport();
            if (defaultImport) removedIdentifiers.add(defaultImport.getText());
            decl.remove();
        }

        this.dirtySourceFiles.add(abs);
        this.logger.log(`Staged removal of ${importsToRemove.length} import(s) in: ${this.rel(abs)}`);
        return { removedIdentifiers, staged: true, skipped: false };
    }

    //Removes the given identifier names from all @Module decorator array properties
    removeModuleMembers(
        filePath: string,
        names: Set<string> | string[]
    ): { staged: boolean; skipped: boolean } {
        const abs = this.resolveRepoPath(filePath);
        if (!existsSync(abs)) {
            this.logger.warn(`removeImportMembers: file not found at ${filePath}, skipping.`);
            return { staged: false, skipped: true };
        }

        const identifiers = names instanceof Set ? names : new Set(names);
        if (identifiers.size === 0) return { staged: false, skipped: true };

        const existing = this.project.getSourceFile(abs);
        const sourceFile = existing
            ? existing
            : this.project.createSourceFile(abs, readFileSync(abs, "utf8"), { overwrite: true });

        const nestModuleClass = sourceFile.getClasses().find(cls =>
            cls.getDecorators().some(dec => dec.getName() === "Module")
        );
        if (!nestModuleClass) {
            this.logger.warn(`removeImportMembers: no @Module() class found in ${filePath}`);
            return { staged: false, skipped: true };
        }

        const moduleDec = nestModuleClass.getDecorators().find(dec => dec.getName() === "Module");
        const arg0 = moduleDec?.getCallExpression()?.getArguments()[0];
        if (!arg0 || !Node.isObjectLiteralExpression(arg0)) return { staged: false, skipped: true };

        const meta = arg0 as ObjectLiteralExpression;
        for (const propName of ["imports", "providers", "controllers", "exports"] as const) {
            const prop = meta.getProperty(propName);
            if (!prop || !Node.isPropertyAssignment(prop)) continue;
            const init = prop.getInitializer();
            if (!init || !Node.isArrayLiteralExpression(init)) continue;
            const arr = init as ArrayLiteralExpression;
            const elements = arr.getElements();
            for (let i = elements.length - 1; i >= 0; i--) {
                const elemText = elements[i].getText().trim();
                // Match direct identifiers (e.g. TestService) or call expressions that reference them (e.g. TypeOrmModule.forFeature([Test])).
                const shouldRemove = identifiers.has(elemText) ||
                    [...identifiers].some(id => new RegExp(`\\b${id}\\b`).test(elemText));
                if (shouldRemove) {
                    arr.removeElement(i);
                }
            }
        }

        this.dirtySourceFiles.add(abs);
        this.logger.log(`Staged removal of [${[...identifiers].join(", ")}] from @Module arrays in: ${this.rel(abs)}`);
        return { staged: true, skipped: false };
    }


    addImport(
        filePath: string,
        importLine: string
    ): { staged: boolean; overwritten: boolean; skipped: boolean } {
        const abs = this.resolveRepoPath(filePath);
        if (!existsSync(abs))
            throw new Error(`addImport: File not found at ${filePath}`);

        let fileContent = readFileSync(abs, "utf8");

        // If import already exists — skip
        if (fileContent.includes(importLine.trim())) {
            this.logger.log(`Skipped adding import (already exists): ${importLine}`);
            return { staged: false, overwritten: false, skipped: true };
        }

        // Find last import statement (so we can insert after all imports)
        const importRegex = /^import .+ from .+;$/gm;
        let lastImportMatch: RegExpExecArray | null;
        let lastImportIndex = -1;

        while ((lastImportMatch = importRegex.exec(fileContent)) !== null) {
            lastImportIndex = lastImportMatch.index + lastImportMatch[0].length;
        }

        // Insert after last import (or at top if none exist)
        let newContent: string;
        if (lastImportIndex !== -1) {
            newContent =
                fileContent.slice(0, lastImportIndex) +
                "\n" +
                importLine.trim() +
                "\n" +
                fileContent.slice(lastImportIndex);
        } else {
            // No imports found — insert at top
            newContent = importLine.trim() + "\n\n" + fileContent;
        }

        writeFileSync(abs, newContent, "utf8");

        this.dirtySourceFiles.add(abs);
        this.logger.log(`Staged import in ${this.rel(abs)}: ${importLine}`);
        return { staged: true, overwritten: false, skipped: false };
    }



}
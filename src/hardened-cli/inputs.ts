import {
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    openSync,
    opendirSync,
    readSync,
    readFileSync,
    realpathSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join, parse as parsePath, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";
import { CliError } from "./errors";
import type { Limits } from "./options";
import type { IncludeEdge } from "../hardened/source-includes";

interface PhysicalIdentity {
    dev: bigint;
    ino: bigint;
    size: bigint;
    mtimeNs: bigint;
}

export interface InputFile {
    absolutePath: string;
    portablePath: string;
    sourceRelativePath: string;
    sourceRoot: string;
    authorityModule?: "application" | "bootstrap";
    expectedQNames?: readonly string[];
    expectedLocalDependencies?: readonly string[];
    allowedLocalDependencies?: readonly string[];
    includeFragment?: boolean;
    identity: PhysicalIdentity;
    byteLength: number;
}

export interface DiscoveredInputs {
    root: string;
    roots: readonly string[];
    files: InputFile[];
    sourceClosureSha256?: string;
    sourceClosureProfileSha256?: string;
    sourcePlanSha256?: string;
    sourcePrefixes?: Readonly<Record<"application" | "bootstrap", string>>;
    sourceIncludeEdges?: Readonly<Record<"application" | "bootstrap", readonly IncludeEdge[]>>;
    authenticatedSourceDocument?: SourceClosureDocument;
}

function compareUtf8(left: string, right: string): number {
    return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function portableCollisionKey(path: string): string {
    let folded = path.normalize("NFC");
    for (let pass = 0; pass < 8; pass++) {
        const next = folded.toUpperCase().toLowerCase().normalize("NFC");
        if (next === folded) {
            return next;
        }
        folded = next;
    }
    return folded;
}

const windowsDeviceName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function validatePortableName(name: string, portablePath: string): void {
    if (name !== name.normalize("NFC")) {
        throw new CliError(`non-NFC path is not portable: ${portablePath}`, 3);
    }
    if (/[\u0000-\u001f\u007f\\:]/.test(name) || /[. ]$/.test(name) || windowsDeviceName.test(name)) {
        throw new CliError(`source path is not portable: ${portablePath}`, 3);
    }
    for (const character of name) {
        if (character.codePointAt(0)! > 0x7f && character.toLowerCase() !== character.toUpperCase()) {
            throw new CliError(`non-ASCII cased source path is not portable: ${portablePath}`, 3);
        }
    }
}

function validatePortableRelativePath(path: string, limits: Limits, label: string): string[] {
    if (path.length === 0 || path.startsWith("/") || path.includes("\\")) {
        throw new CliError(`${label} is not a portable relative path`, 6);
    }
    const segments = path.split("/");
    if (segments.some(segment => segment === "" || segment === "." || segment === "..")) {
        throw new CliError(`${label} escapes its source root`, 6);
    }
    for (const segment of segments) validatePortableName(segment, path);
    if (segments.length > limits.maxDepth) throw new CliError(`${label} exceeds --max-depth`, 5);
    if (Buffer.byteLength(path, "utf8") > limits.maxPathBytes) {
        throw new CliError(`${label} exceeds --max-path-bytes`, 5);
    }
    return segments;
}

function isWithin(root: string, candidate: string): boolean {
    const fromRoot = relative(root, candidate);
    return fromRoot === "" || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`));
}

export function assertNoSymlinkComponents(path: string, label: string): void {
    const absolute = resolve(path);
    const root = parsePath(absolute).root;
    let current = root;
    const components = relative(root, absolute).split(sep).filter(component => component !== "");
    for (const component of components) {
        current = join(current, component);
        let stat: ReturnType<typeof lstatSync>;
        try {
            stat = lstatSync(current);
        } catch {
            throw new CliError(`${label} does not exist`, 3);
        }
        if (stat.isSymbolicLink()) {
            throw new CliError(`${label} contains a symlink or junction component`, 3);
        }
    }
}

function toIdentity(stat: ReturnType<typeof lstatSync>): PhysicalIdentity {
    const bigintStat = stat as unknown as {
        dev: bigint;
        ino: bigint;
        size: bigint;
        mtimeNs: bigint;
    };
    return {
        dev: bigintStat.dev,
        ino: bigintStat.ino,
        size: bigintStat.size,
        mtimeNs: bigintStat.mtimeNs,
    };
}

function sameIdentity(left: PhysicalIdentity, right: PhysicalIdentity): boolean {
    return left.dev === right.dev &&
        left.ino === right.ino &&
        left.size === right.size &&
        left.mtimeNs === right.mtimeNs;
}

export function discoverInputs(sourceArgument: string, limits: Limits): DiscoveredInputs {
    const lexicalRoot = resolve(sourceArgument);
    assertNoSymlinkComponents(lexicalRoot, "source directory");
    let rootStat: ReturnType<typeof lstatSync> | undefined;
    try {
        rootStat = lstatSync(lexicalRoot, { bigint: true }) as unknown as ReturnType<typeof lstatSync>;
    } catch {
        throw new CliError("source directory does not exist", 3);
    }
    if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
        throw new CliError("source root must be a real directory, not a symlink or junction", 3);
    }
    const root = realpathSync.native(lexicalRoot);
    const files: InputFile[] = [];
    const identities = new Map<string, string>();
    let totalBytes = 0;
    let entryCount = 0;
    let directoryCount = 1;
    const pending: Array<{ directory: string; segments: string[] }> = [{ directory: root, segments: [] }];

    while (pending.length > 0) {
        const { directory, segments } = pending.pop()!;
        const entries: import("node:fs").Dirent[] = [];
        const directoryHandle = opendirSync(directory);
        try {
            for (;;) {
                const entry = directoryHandle.readSync();
                if (entry === null) {
                    break;
                }
                entryCount++;
                if (entryCount > limits.maxEntries) {
                    throw new CliError("source tree exceeds --max-entries", 5);
                }
                entries.push(entry);
            }
        } finally {
            directoryHandle.closeSync();
        }
        const names = new Map<string, string>();
        for (const entry of entries) {
            validatePortableName(entry.name, [...segments, entry.name].join("/"));
            const key = portableCollisionKey(entry.name);
            const previous = names.get(key);
            if (previous !== undefined && previous !== entry.name) {
                throw new CliError(`case/NFC path collision: ${previous} and ${entry.name}`, 3);
            }
            names.set(key, entry.name);
        }
        entries.sort((left, right) => compareUtf8(left.name, right.name));
        const childDirectories: Array<{ directory: string; segments: string[] }> = [];
        for (const entry of entries) {
            const childSegments = [...segments, entry.name];
            const portablePath = childSegments.join("/");
            if (childSegments.length > limits.maxDepth) {
                throw new CliError(`source path exceeds --max-depth: ${portablePath}`, 5);
            }
            if (Buffer.byteLength(portablePath, "utf8") > limits.maxPathBytes) {
                throw new CliError(`source path exceeds --max-path-bytes: ${portablePath}`, 5);
            }
            const absolutePath = resolve(directory, entry.name);
            const stat = lstatSync(absolutePath, { bigint: true });
            if (stat.isSymbolicLink()) {
                throw new CliError(`symlink or junction is forbidden in source tree: ${portablePath}`, 3);
            }
            const canonical = realpathSync.native(absolutePath);
            if (!isWithin(root, canonical)) {
                throw new CliError(`source path escapes its root: ${portablePath}`, 3);
            }
            if (stat.isDirectory()) {
                directoryCount++;
                if (directoryCount > limits.maxDirectories) {
                    throw new CliError("source tree exceeds --max-directories", 5);
                }
                childDirectories.push({ directory: canonical, segments: childSegments });
            } else if (stat.isFile()) {
                if (!/\.as$/i.test(entry.name)) {
                    continue;
                }
                const byteLength = Number(stat.size);
                if (!Number.isSafeInteger(byteLength) || byteLength > limits.maxFileBytes) {
                    throw new CliError(`source exceeds --max-file-bytes: ${portablePath}`, 5);
                }
                totalBytes += byteLength;
                if (totalBytes > limits.maxTotalBytes) {
                    throw new CliError("source set exceeds --max-total-bytes", 5);
                }
                const identity = toIdentity(stat as unknown as ReturnType<typeof lstatSync>);
                const identityKey = `${identity.dev}:${identity.ino}`;
                const duplicate = identities.get(identityKey);
                if (duplicate !== undefined) {
                    throw new CliError(`hard-linked source aliases are forbidden: ${duplicate} and ${portablePath}`, 3);
                }
                identities.set(identityKey, portablePath);
                files.push({
                    absolutePath: canonical,
                    portablePath,
                    sourceRelativePath: portablePath,
                    sourceRoot: root,
                    identity,
                    byteLength,
                });
                if (files.length > limits.maxFiles) {
                    throw new CliError("source set exceeds --max-files", 5);
                }
            } else {
                throw new CliError(`non-regular source entry is forbidden: ${portablePath}`, 3);
            }
        }
        for (let index = childDirectories.length - 1; index >= 0; index--) {
            pending.push(childDirectories[index]!);
        }
    }
    if (files.length === 0) {
        throw new CliError("source tree contains no ActionScript files", 3);
    }
    files.sort((left, right) => compareUtf8(left.portablePath, right.portablePath));
    return { root, roots: [root], files };
}

type SourceModule = "application" | "bootstrap";

interface ClosureFileDocument {
    path: string;
    bytes: number;
    sha256: string;
    qnames: string[];
    localDependencies?: string[];
    allowedLocalDependencies?: string[];
}

interface ClosureIncludesDocument {
    fragments: Array<{path:string;bytes:number;sha256:string}>;
    edges: IncludeEdge[];
}

interface ClosureRootDocument {
    module: SourceModule;
    path: string;
    sourcePrefix: string;
    files: ClosureFileDocument[];
    includes?: ClosureIncludesDocument;
}

interface SourceClosureDocument {
    schema: "as3-authenticated-source-closure@1" | "as3-authenticated-source-closure@2" | "as3-authenticated-source-plan@1";
    profileSha256: string;
    roots: ClosureRootDocument[];
}

const SHA256 = /^[0-9a-f]{64}$/;
const QNAME = /^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/;

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort(), expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonical(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
    }
    throw new CliError("source closure contains a non-JSON value", 6);
}

function compareStrings(left: string, right: string): number {
    return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function assertSortedUnique(values: readonly string[], label: string): void {
    for (let index = 1; index < values.length; index++) {
        if (compareStrings(values[index - 1]!, values[index]!) >= 0) {
            throw new CliError(`${label} must be strictly UTF-8 sorted and unique`, 6);
        }
    }
}

function readClosureDocument(pathArgument: string, expected:"closure"|"plan"):
    { document: SourceClosureDocument; sha256: string } {
    const lexical = resolve(pathArgument);
    assertNoSymlinkComponents(lexical, "source closure");
    const stat = lstatSync(lexical);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024
        || realpathSync.native(lexical) !== lexical) {
        throw new CliError("source closure must be an ordinary bounded canonical file", 6);
    }
    const raw = readFileSync(lexical);
    const text = raw.toString("utf8");
    if (Buffer.from(text, "utf8").compare(raw) !== 0) throw new CliError("source closure must be exact UTF-8", 6);
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new CliError("source closure is not JSON", 6); }
    if (`${canonical(value)}\n` !== text) throw new CliError("source closure must be canonical JSON with one trailing LF", 6);
    const schema=value && typeof value==="object"&&!Array.isArray(value)?(value as Record<string,unknown>).schema:null;
    if (!exactKeys(value, ["profileSha256", "roots", "schema"])
        || (expected==="plan"?schema!=="as3-authenticated-source-plan@1"
            :schema!=="as3-authenticated-source-closure@1"&&schema!=="as3-authenticated-source-closure@2")
        || typeof value.profileSha256 !== "string" || !SHA256.test(value.profileSha256)
        || !Array.isArray(value.roots) || value.roots.length !== 2) {
        throw new CliError("source closure has the wrong closed schema", 6);
    }
    return { document: value as unknown as SourceClosureDocument,
        sha256: createHash("sha256").update(raw).digest("hex") };
}

/** Discover only the exact files named by a profile-bound, two-root source closure. */
export function discoverAuthenticatedInputs(sourceArgument: string, closureArgument: string,
    limits: Limits): DiscoveredInputs {
    return discoverAuthenticatedDocument(sourceArgument,closureArgument,limits,"closure");
}

export function discoverAuthenticatedSourcePlan(sourceArgument:string,planArgument:string,limits:Limits):DiscoveredInputs {
    return discoverAuthenticatedDocument(sourceArgument,planArgument,limits,"plan");
}

function discoverAuthenticatedDocument(sourceArgument:string,documentArgument:string,limits:Limits,
    mode:"closure"|"plan"):DiscoveredInputs {
    const loaded = readClosureDocument(documentArgument,mode), document = loaded.document;
    const lexicalBase = resolve(sourceArgument);
    assertNoSymlinkComponents(lexicalBase, "source base");
    const baseStat = lstatSync(lexicalBase);
    if (!baseStat.isDirectory() || baseStat.isSymbolicLink() || realpathSync.native(lexicalBase) !== lexicalBase) {
        throw new CliError("source base must be a real canonical directory", 6);
    }
    const expectedModules: readonly SourceModule[] = ["application", "bootstrap"];
    const files: InputFile[] = [], physicalOwners = new Map<string, string>(), qnameOwners = new Map<string, string>();
    const roots: string[] = [];
    const sourcePrefixes = Object.create(null) as Record<SourceModule, string>;
    const sourceIncludeEdges = Object.create(null) as Record<SourceModule, readonly IncludeEdge[]>;
    let totalBytes = 0, entryCount = 0;
    for (let rootIndex = 0; rootIndex < document.roots.length; rootIndex++) {
        const rootValue: unknown = document.roots[rootIndex], expectedModule = expectedModules[rootIndex]!;
        const extended=document.schema!=="as3-authenticated-source-closure@1";
        if (!exactKeys(rootValue, extended?["files", "includes", "module", "path", "sourcePrefix"]
            :["files", "module", "path", "sourcePrefix"])) {
            throw new CliError("source closure root has the wrong closed schema", 6);
        }
        const root = rootValue as unknown as ClosureRootDocument;
        if (root.module !== expectedModule) throw new CliError("source closure root order must be application then bootstrap", 6);
        if (typeof root.path !== "string" || typeof root.sourcePrefix !== "string" || root.sourcePrefix.length === 0
            || !root.sourcePrefix.endsWith("/") || root.sourcePrefix.startsWith("/") || root.sourcePrefix.includes("\\")
            || root.sourcePrefix.split("/").slice(0, -1).some(segment => segment === "" || segment === "." || segment === "..")
            || !Array.isArray(root.files) || root.files.length === 0) {
            throw new CliError(`source closure ${expectedModule} root is invalid`, 6);
        }
        validatePortableRelativePath(root.sourcePrefix.slice(0, -1), limits,
            `${expectedModule} profile source prefix`);
        const rootSegments = validatePortableRelativePath(root.path, limits, `${expectedModule} source root path`);
        const absoluteRoot = resolve(lexicalBase, ...rootSegments);
        if (!isWithin(lexicalBase, absoluteRoot)) throw new CliError(`${expectedModule} source root escapes source base`, 6);
        assertNoSymlinkComponents(absoluteRoot, `${expectedModule} source root`);
        const rootStat = lstatSync(absoluteRoot);
        if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || realpathSync.native(absoluteRoot) !== absoluteRoot) {
            throw new CliError(`${expectedModule} source root must be a real canonical directory`, 6);
        }
        if (roots.some(prior => pathsOverlap(prior, absoluteRoot))) throw new CliError("source closure roots must not overlap", 6);
        roots.push(absoluteRoot); sourcePrefixes[root.module] = root.sourcePrefix;
        const dependencyKey=mode==="plan"?"allowedLocalDependencies":"localDependencies";
        const fileKeys=["bytes",dependencyKey,"path","qnames","sha256"];
        const listedPaths = root.files.map(item => exactKeys(item, fileKeys)
            && typeof item.path === "string" ? item.path : "");
        if (listedPaths.some(path => path === "")) throw new CliError("source closure file has the wrong closed schema", 6);
        assertSortedUnique(listedPaths, `${root.module} source closure paths`);
        const collisionPaths = new Map<string, string>();
        for (let fileIndex = 0; fileIndex < root.files.length; fileIndex++) {
            const itemValue: unknown = root.files[fileIndex];
            if (!exactKeys(itemValue, fileKeys)) {
                throw new CliError("source closure file has the wrong closed schema", 6);
            }
            const item = itemValue as unknown as ClosureFileDocument;
            const dependencies=(mode==="plan"?item.allowedLocalDependencies:item.localDependencies)!;
            const segments = validatePortableRelativePath(item.path, limits, "source closure file path");
            if (!/\.as$/i.test(item.path) || !Number.isSafeInteger(item.bytes) || item.bytes < 0
                || item.bytes > limits.maxFileBytes || typeof item.sha256 !== "string" || !SHA256.test(item.sha256)
                || !Array.isArray(item.qnames) || item.qnames.length !== 1 || item.qnames.some(qname => typeof qname !== "string" || !QNAME.test(qname))
                || !Array.isArray(dependencies)
                || dependencies.some(qname => typeof qname !== "string" || !QNAME.test(qname))) {
                throw new CliError(`source closure file is invalid: ${item.path}`, 6);
            }
            assertSortedUnique(item.qnames, `${item.path} qnames`);
            assertSortedUnique(dependencies, `${item.path} ${mode==="plan"?"allowed ":""}local dependencies`);
            const collisionKey = portableCollisionKey(item.path), priorPath = collisionPaths.get(collisionKey);
            if (priorPath !== undefined) throw new CliError(`source closure path collides by case or NFC: ${priorPath} and ${item.path}`, 6);
            collisionPaths.set(collisionKey, item.path);
            const absolutePath = resolve(absoluteRoot, ...segments);
            if (!isWithin(absoluteRoot, absolutePath)) throw new CliError(`source closure file escapes its root: ${item.path}`, 6);
            assertNoSymlinkComponents(absolutePath, "source closure file");
            const stat = lstatSync(absolutePath, { bigint: true });
            if (!stat.isFile() || stat.isSymbolicLink() || realpathSync.native(absolutePath) !== absolutePath) {
                throw new CliError(`source closure entry is not a canonical regular file: ${item.path}`, 6);
            }
            const identity = toIdentity(stat as unknown as ReturnType<typeof lstatSync>), identityKey = `${identity.dev}:${identity.ino}`;
            const logicalPath = `${root.sourcePrefix}${item.path}`, priorPhysical = physicalOwners.get(identityKey);
            if (priorPhysical !== undefined) throw new CliError(`hard-linked source aliases are forbidden: ${priorPhysical} and ${logicalPath}`, 6);
            physicalOwners.set(identityKey, logicalPath);
            if (Number(stat.size) !== item.bytes) throw new CliError(`source closure byte length drift: ${logicalPath}`, 6);
            for (const qname of item.qnames) {
                const key = portableCollisionKey(qname), prior = qnameOwners.get(key);
                if (prior !== undefined) throw new CliError(`duplicate source QName in authenticated closure: ${prior} and ${qname}`, 6);
                qnameOwners.set(key, qname);
            }
            const file: InputFile = { absolutePath, portablePath: logicalPath, sourceRelativePath: item.path,
                sourceRoot: absoluteRoot, authorityModule: root.module, expectedQNames: Object.freeze([...item.qnames]),
                ...(mode==="plan"?{allowedLocalDependencies:Object.freeze([...dependencies])}
                    :{expectedLocalDependencies:Object.freeze([...dependencies])}), identity, byteLength: item.bytes };
            if (createHash("sha256").update(readInput(file).bytes).digest("hex") !== item.sha256) {
                throw new CliError(`source closure content drift: ${logicalPath}`, 6);
            }
            files.push(file); totalBytes += item.bytes; entryCount++;
            if (files.length > limits.maxFiles) throw new CliError("source closure exceeds --max-files", 5);
            if (entryCount > limits.maxEntries) throw new CliError("source closure exceeds --max-entries", 5);
            if (totalBytes > limits.maxTotalBytes) throw new CliError("source closure exceeds --max-total-bytes", 5);
        }
        if(extended) {
            if(!exactKeys(root.includes,["edges","fragments"]) || !Array.isArray(root.includes.fragments)
                || !Array.isArray(root.includes.edges)) throw new CliError(`source closure ${root.module} includes are invalid`,6);
            const fragmentPaths=root.includes.fragments.map(item=>exactKeys(item,["bytes","path","sha256"])
                && typeof item.path==="string"?item.path:"");
            if(fragmentPaths.some(path=>path==="")) throw new CliError("source closure include fragment has the wrong closed schema",6);
            assertSortedUnique(fragmentPaths,`${root.module} include fragment paths`);
            const owned=new Set(root.files.map(item=>item.path));
            for(const fragment of root.includes.fragments) {
                const segments=validatePortableRelativePath(fragment.path,limits,"source closure include fragment path");
                if(!/\.as$/i.test(fragment.path)||!Number.isSafeInteger(fragment.bytes)||fragment.bytes<0
                    || fragment.bytes>limits.maxFileBytes||typeof fragment.sha256!=="string"||!SHA256.test(fragment.sha256)
                    || owned.has(fragment.path)) throw new CliError(`source closure include fragment is invalid: ${fragment.path}`,6);
                owned.add(fragment.path);
                const absolutePath=resolve(absoluteRoot,...segments);
                if(!isWithin(absoluteRoot,absolutePath)) throw new CliError("source closure include fragment escapes its root",6);
                assertNoSymlinkComponents(absolutePath,"source closure include fragment");
                const stat=lstatSync(absolutePath,{bigint:true});
                if(!stat.isFile()||stat.isSymbolicLink()||realpathSync.native(absolutePath)!==absolutePath
                    || Number(stat.size)!==fragment.bytes) throw new CliError("source closure include fragment identity drift",6);
                const identity=toIdentity(stat as unknown as ReturnType<typeof lstatSync>),identityKey=`${identity.dev}:${identity.ino}`;
                const logicalPath=`${root.sourcePrefix}${fragment.path}`,priorPhysical=physicalOwners.get(identityKey);
                if(priorPhysical!==undefined) throw new CliError(`hard-linked source aliases are forbidden: ${priorPhysical} and ${logicalPath}`,6);
                physicalOwners.set(identityKey,logicalPath);
                const file:InputFile={absolutePath,portablePath:logicalPath,sourceRelativePath:fragment.path,
                    sourceRoot:absoluteRoot,authorityModule:root.module,includeFragment:true,identity,byteLength:fragment.bytes};
                if(createHash("sha256").update(readInput(file).bytes).digest("hex")!==fragment.sha256)
                    throw new CliError(`source closure include fragment content drift: ${logicalPath}`,6);
                files.push(file);totalBytes+=fragment.bytes;entryCount++;
                if(files.length>limits.maxFiles) throw new CliError("source closure exceeds --max-files",5);
                if(entryCount>limits.maxEntries) throw new CliError("source closure exceeds --max-entries",5);
                if(totalBytes>limits.maxTotalBytes) throw new CliError("source closure exceeds --max-total-bytes",5);
            }
            const edgeKeys=new Set<string>();
            for(const edge of root.includes.edges) {
                if(!exactKeys(edge,["directiveEnd","directiveStart","ownerPath","specifier","targetPath","targetSha256"])
                    ||typeof edge.ownerPath!=="string"||typeof edge.targetPath!=="string"||typeof edge.specifier!=="string"
                    ||!Number.isSafeInteger(edge.directiveStart)||!Number.isSafeInteger(edge.directiveEnd)
                    ||edge.directiveStart<0||edge.directiveEnd<=edge.directiveStart||typeof edge.targetSha256!=="string"
                    ||!SHA256.test(edge.targetSha256)||!owned.has(edge.ownerPath)||!owned.has(edge.targetPath))
                    throw new CliError(`source closure ${root.module} include edge is invalid`,6);
                const key=canonical(edge);if(edgeKeys.has(key)) throw new CliError("source closure duplicate include edge",6);edgeKeys.add(key);
            }
            const sorted=[...root.includes.edges].sort((left,right)=>compareStrings(canonical(left),canonical(right)));
            if(canonical(sorted)!==canonical(root.includes.edges)) throw new CliError("source closure include edges must be strictly canonical sorted",6);
            sourceIncludeEdges[root.module]=Object.freeze([...root.includes.edges]);
        } else sourceIncludeEdges[root.module]=Object.freeze([]);
    }
    const availableQNames = new Set(files.flatMap(file => file.expectedQNames || []));
    for (const file of files.filter(item=>!item.includeFragment)) for (const dependency of
        (file.expectedLocalDependencies||file.allowedLocalDependencies)!) {
        if (!availableQNames.has(dependency)) {
            throw new CliError(`authenticated source closure is missing local dependency ${dependency} required by ${file.portablePath}`, 6);
        }
    }
    files.sort((left, right) => compareStrings(left.portablePath, right.portablePath));
    return { root: lexicalBase, roots: Object.freeze(roots), files,
        ...(mode==="plan"?{sourcePlanSha256:loaded.sha256}:{sourceClosureSha256:loaded.sha256}),
        sourceClosureProfileSha256: document.profileSha256,
        sourcePrefixes: Object.freeze(sourcePrefixes),sourceIncludeEdges:Object.freeze(sourceIncludeEdges),
        authenticatedSourceDocument:document };
}

export function deriveAuthenticatedSourceClosure(inputs:DiscoveredInputs,
    exactDependencies:ReadonlyMap<string,readonly string[]>):string {
    if(!inputs.sourcePlanSha256||!inputs.authenticatedSourceDocument
        ||inputs.authenticatedSourceDocument.schema!=="as3-authenticated-source-plan@1")
        throw new CliError("exact source closure derivation requires an authenticated source plan",6);
    const plan=inputs.authenticatedSourceDocument;
    const ownerByQName=new Map<string,string>();
    for(const root of plan.roots) for(const file of root.files) for(const qname of file.qnames)
        ownerByQName.set(qname,`${root.sourcePrefix}${file.path}`);
    const reachable=new Set(plan.roots.filter(root=>root.module==="application")
        .flatMap(root=>root.files.map(file=>`${root.sourcePrefix}${file.path}`)));
    for(let changed=true;changed;) { changed=false; for(const logical of [...reachable]) {
        const dependencies=exactDependencies.get(logical);
        if(!dependencies) throw new CliError(`source plan has no derived semantic dependency set for ${logical}`,6);
        for(const dependency of dependencies) {
            const owner=ownerByQName.get(dependency);
            if(!owner) throw new CliError(`derived semantic dependency ${dependency} is absent from the authenticated plan`,6);
            if(!reachable.has(owner)){reachable.add(owner);changed=true;}
        }
    }}
    const roots=plan.roots.map(root=>{
        const files=root.files.filter(file=>reachable.has(`${root.sourcePrefix}${file.path}`)).map(file=>{
        const logical=`${root.sourcePrefix}${file.path}`,dependencies=exactDependencies.get(logical);
        if(!dependencies) throw new CliError(`source plan has no derived semantic dependency set for ${logical}`,6);
        assertSortedUnique(dependencies,`${logical} derived local dependencies`);
        return {bytes:file.bytes,localDependencies:[...dependencies],path:file.path,qnames:[...file.qnames],sha256:file.sha256};
        });
        const includePaths=new Set(files.map(file=>file.path)),edges:IncludeEdge[]=[];
        for(let changed=true;changed;) { changed=false; for(const edge of root.includes!.edges) if(includePaths.has(edge.ownerPath)) {
            if(!edges.some(item=>canonical(item)===canonical(edge))) edges.push(edge);
            if(!includePaths.has(edge.targetPath)){includePaths.add(edge.targetPath);changed=true;}
        }}
        edges.sort((left,right)=>compareStrings(canonical(left),canonical(right)));
        const fragments=root.includes!.fragments.filter(fragment=>includePaths.has(fragment.path));
        return {files,includes:{edges,fragments},module:root.module,path:root.path,sourcePrefix:root.sourcePrefix};
    });
    return `${canonical({profileSha256:plan.profileSha256,roots,schema:"as3-authenticated-source-closure@2"})}\n`;
}

export interface ReadInput {
    bytes: Buffer;
    content: string;
}

export function readInput(file: InputFile): ReadInput {
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    let descriptor: number;
    try {
        descriptor = openSync(file.absolutePath, constants.O_RDONLY | noFollow);
    } catch {
        throw new CliError(`cannot safely open source: ${file.portablePath}`, 3);
    }
    try {
        const before = toIdentity(fstatSync(descriptor, { bigint: true }) as unknown as ReturnType<typeof lstatSync>);
        if (!sameIdentity(file.identity, before)) {
            throw new CliError(`source changed after discovery: ${file.portablePath}`, 3);
        }
        const bytes = Buffer.allocUnsafe(file.byteLength + 1);
        let bytesRead = 0;
        while (bytesRead < bytes.byteLength) {
            const count = readSync(descriptor, bytes, bytesRead, bytes.byteLength - bytesRead, null);
            if (count === 0) {
                break;
            }
            bytesRead += count;
        }
        const after = toIdentity(fstatSync(descriptor, { bigint: true }) as unknown as ReturnType<typeof lstatSync>);
        if (!sameIdentity(before, after) || bytesRead !== file.byteLength) {
            throw new CliError(`source changed while reading: ${file.portablePath}`, 3);
        }
        const exactBytes = bytes.subarray(0, bytesRead);
        let content: string;
        try {
            content = new TextDecoder("utf-8", { fatal: true }).decode(exactBytes);
        } catch {
            throw new CliError(`source is not valid UTF-8: ${file.portablePath}`, 3);
        }
        if (content.includes("\0")) {
            throw new CliError(`source contains a NUL character: ${file.portablePath}`, 3);
        }
        return { bytes: exactBytes, content };
    } finally {
        closeSync(descriptor);
    }
}

export function pathsOverlap(left: string, right: string): boolean {
    return isWithin(left, right) || isWithin(right, left);
}

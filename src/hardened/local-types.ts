import { HardenedSemanticError, LoadedLocalTypeAuthority, LocalTypeMapping } from "./contracts";

export interface LocalTypeAuthorityInput {
    json: string;
    sha256: string;
    expectedEntryCount: number;
    expectedDependencyGraphRawSha256: string;
    expectedDependencyGraphSemanticSha256: string;
    expectedSourceManifestSha256: string;
}

export type LocalTypeSha256 = (bytes: string) => string;

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f]{16}$/;
const PREREQUISITE = /^(?:[0-9a-f]{16}|flash-[0-9a-f]{16})$/;
const QNAME = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const AUTHORITIES = new WeakSet<object>();

function fail(code: string, message: string): never {
    throw new HardenedSemanticError(code, message);
}

function object(value: unknown): value is { [key: string]: unknown } {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: { [key: string]: unknown }, expected: string[]): boolean {
    const actual = Object.keys(value).sort();
    const sorted = expected.slice().sort();
    return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function compareUtf8(left: string, right: string): number {
    // Every admitted identity, path, and schema key is restricted to ASCII,
    // whose UTF-8 byte order is identical to ECMAScript string order.
    return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (object(value)) {
        return `{${Object.keys(value).sort(compareUtf8).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
    }
    fail("HARDENED_LOCAL_AUTHORITY_JSON", "local type authority contains a non-JSON value");
}

function safePath(value: string, prefix: string, suffix: string): boolean {
    return value.startsWith(prefix) && value.endsWith(suffix) && value.length <= 4096
        && !value.includes("\\") && !value.includes("//") && !value.split("/").some(segment =>
            segment === "" || segment === "." || segment === ".." || segment.startsWith("_")
            || !/^[A-Za-z0-9_$.-]+$/.test(segment));
}

function freeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        Object.keys(value as unknown as { [key: string]: unknown }).forEach(key =>
            freeze((value as unknown as { [key: string]: unknown })[key]));
        Object.freeze(value);
    }
    return value;
}

export function loadLocalTypeAuthority(input: LocalTypeAuthorityInput, sha256: LocalTypeSha256): LoadedLocalTypeAuthority {
    if (!object(input) || !exactKeys(input as unknown as { [key: string]: unknown }, [
        "expectedDependencyGraphRawSha256", "expectedDependencyGraphSemanticSha256", "expectedEntryCount",
        "expectedSourceManifestSha256", "json", "sha256",
    ]) || typeof input.json !== "string" || typeof input.sha256 !== "string" || !SHA256.test(input.sha256)
        || sha256(input.json) !== input.sha256) {
        fail("HARDENED_LOCAL_AUTHORITY_HASH", "local type authority bytes do not match their exact digest");
    }
    let document: unknown;
    try { document = JSON.parse(input.json); } catch (_error) {
        fail("HARDENED_LOCAL_AUTHORITY_JSON", "local type authority is not JSON");
    }
    if (!object(document) || !exactKeys(document, [
        "dependencyGraphRawSha256", "dependencyGraphSemanticSha256", "entries", "entryCount", "schema",
        "sourceManifestSha256",
    ]) || document.schema !== "bleach-local-as3-type-map@2" || !Array.isArray(document.entries)
        || document.entryCount !== input.expectedEntryCount || document.entries.length !== input.expectedEntryCount
        || document.dependencyGraphRawSha256 !== input.expectedDependencyGraphRawSha256
        || document.dependencyGraphSemanticSha256 !== input.expectedDependencyGraphSemanticSha256
        || document.sourceManifestSha256 !== input.expectedSourceManifestSha256
        || `${canonical(document)}\n` !== input.json) {
        fail("HARDENED_LOCAL_AUTHORITY_SCHEMA", "local type authority schema, pins, count, or canonical bytes are invalid");
    }
    const entries: LocalTypeMapping[] = [];
    const entriesByIdentity: { [identity: string]: LocalTypeMapping } = Object.create(null);
    let previous = "";
    document.entries.forEach((raw, index) => {
        if (!object(raw) || !exactKeys(raw, [
            "componentId", "graphSourceSha256", "importable", "module", "nodeId", "prerequisites", "qname",
            "sourceContentSha256", "sourcePath", "targetPath", "topologicalLevel", "typeKind",
        ])) fail("HARDENED_LOCAL_AUTHORITY_ENTRY", `local type entry ${index} has the wrong shape`);
        const entry = raw as unknown as LocalTypeMapping;
        const identity = `${entry.module}\u0000${entry.qname}`;
        const sourcePrefix = entry.module === "application" ? "game-client/tapplication_main/src/" : "game-client/tmain/src/";
        const targetPrefix = entry.module === "application" ? "game-client/layaair/src/application/" : "game-client/layaair/src/bootstrap/";
        if ((entry.module !== "application" && entry.module !== "bootstrap") || !ID.test(entry.nodeId)
            || !/^scc-[0-9]{5}$/.test(entry.componentId) || typeof entry.importable !== "boolean"
            || typeof entry.qname !== "string" || /[\u0000-\u001f\u007f]/.test(entry.qname)
            || entry.importable !== QNAME.test(entry.qname)
            || !safePath(entry.sourcePath, sourcePrefix, ".as") || !safePath(entry.targetPath, targetPrefix, ".ts")
            || !SHA256.test(entry.graphSourceSha256) || !SHA256.test(entry.sourceContentSha256)
            || !Number.isInteger(entry.topologicalLevel) || entry.topologicalLevel < 0
            || (entry.typeKind !== "class" && entry.typeKind !== "interface" && entry.typeKind !== "package")
            || !Array.isArray(entry.prerequisites) || entry.prerequisites.some(item => !PREREQUISITE.test(item))
            || entry.prerequisites.some((item, itemIndex) => itemIndex > 0 && compareUtf8(entry.prerequisites[itemIndex - 1]!, item) >= 0)
            || identity <= previous || entriesByIdentity[identity]) {
            fail("HARDENED_LOCAL_AUTHORITY_ENTRY", `local type entry ${index} is invalid, unsafe, duplicated, or unsorted`);
        }
        previous = identity;
        const copy: LocalTypeMapping = {
            componentId: entry.componentId, graphSourceSha256: entry.graphSourceSha256,
            importable: entry.importable, module: entry.module, nodeId: entry.nodeId,
            prerequisites: entry.prerequisites.slice(), qname: entry.qname, sourcePath: entry.sourcePath,
            sourceContentSha256: entry.sourceContentSha256, targetPath: entry.targetPath,
            topologicalLevel: entry.topologicalLevel,
            typeKind: entry.typeKind,
        };
        entries.push(copy);
        entriesByIdentity[identity] = copy;
    });
    const authority: LoadedLocalTypeAuthority = {
        dependencyGraphRawSha256: String(document.dependencyGraphRawSha256),
        dependencyGraphSemanticSha256: String(document.dependencyGraphSemanticSha256),
        sourceManifestSha256: String(document.sourceManifestSha256), entries, entriesByIdentity,
    };
    freeze(authority);
    AUTHORITIES.add(authority);
    return authority;
}

export function assertLoadedLocalTypeAuthority(value: LoadedLocalTypeAuthority): void {
    if (!object(value) || !AUTHORITIES.has(value)) {
        fail("HARDENED_LOCAL_AUTHORITY_INSTANCE", "local imports require an immutable loaded local type authority");
    }
}

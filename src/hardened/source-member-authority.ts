import { HardenedSemanticError } from "./contracts";

export interface SourceMemberAuthorityEntry {
    readonly qname: string;
    readonly baseQName: string | null;
    readonly dynamic?: boolean;
    readonly ownInstanceMemberNames: readonly string[];
}

export interface LoadedSourceMemberAuthority {
    readonly schema: "as3-source-member-authority@1" | "as3-source-member-authority@2";
    readonly sourceArtifactSha256: string;
    readonly entriesByQName: Readonly<Record<string, SourceMemberAuthorityEntry>>;
}

const LOADED = new WeakSet<object>();
const SHA256 = /^[0-9a-f]{64}$/;
const QNAME = /^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function plainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
    return plainRecord(value)
        && Object.keys(value).slice().sort().join("\0") === [...expected].sort().join("\0");
}

/** Load a complete, hash-pinned source API member census used for lexical shadowing and native member absence checks. */
export function loadSourceMemberAuthority(json: string, expectedSha256: string,
    sha256: (bytes: string) => string): LoadedSourceMemberAuthority {
    if (!SHA256.test(expectedSha256) || sha256(json) !== expectedSha256) {
        throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_AUTHORITY_PIN",
            "source member authority bytes do not match the selected application profile");
    }
    let document: unknown;
    try { document = JSON.parse(json); } catch {
        throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_AUTHORITY_JSON",
            "source member authority is not JSON");
    }
    if (!exactKeys(document, ["entries", "entryCount", "generator", "schema", "sourceArtifactSha256"])
        || (document.schema !== "as3-source-member-authority@1" && document.schema !== "as3-source-member-authority@2")
        || document.generator !== "air-sdk-swfdump-abc@1"
        || typeof document.sourceArtifactSha256 !== "string" || !SHA256.test(document.sourceArtifactSha256)
        || !Number.isSafeInteger(document.entryCount) || (document.entryCount as number) < 1
        || !Array.isArray(document.entries) || document.entries.length !== document.entryCount) {
        throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_AUTHORITY_SCHEMA",
            "source member authority has the wrong closed schema");
    }
    const entriesByQName: Record<string, SourceMemberAuthorityEntry> = Object.create(null);
    let previous = "";
    for (const value of document.entries) {
        if (!exactKeys(value, ["baseQName", "ownInstanceMemberNames", "qname", ...(document.schema === "as3-source-member-authority@2" ? ["dynamic"] : [])])) {
            throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_AUTHORITY_ENTRY",
                "source member authority contains an invalid, duplicate, or unsorted entry");
        }
        const qname = value.qname;
        const baseQName = value.baseQName;
        const names = value.ownInstanceMemberNames;
        if (document.schema === "as3-source-member-authority@2" && typeof value.dynamic !== "boolean"
            || typeof qname !== "string" || !QNAME.test(qname) || qname <= previous
            || (baseQName !== null && (typeof baseQName !== "string" || !QNAME.test(baseQName)))
            || !Array.isArray(names)
            || names.some(name => typeof name !== "string" || !IDENTIFIER.test(name))
            || names.some((name, index) => index > 0 && name <= names[index - 1])) {
            throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_AUTHORITY_ENTRY",
                "source member authority contains an invalid, duplicate, or unsorted entry");
        }
        previous = qname;
        entriesByQName[qname] = Object.freeze({
            qname,
            ...(document.schema === "as3-source-member-authority@2" ? {dynamic:value.dynamic as boolean} : {}),
            baseQName: baseQName as string | null,
            ownInstanceMemberNames: Object.freeze([...(names as string[])]),
        });
    }
    for (const entry of Object.values(entriesByQName)) {
        if (entry.baseQName !== null && entriesByQName[entry.baseQName] === undefined) {
            throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_AUTHORITY_CLOSURE",
                `source member authority is missing base ${entry.baseQName}`);
        }
    }
    const loaded: LoadedSourceMemberAuthority = Object.freeze({
        schema: document.schema as LoadedSourceMemberAuthority["schema"],
        sourceArtifactSha256: document.sourceArtifactSha256 as string,
        entriesByQName: Object.freeze(entriesByQName),
    });
    LOADED.add(loaded);
    return loaded;
}

export function assertLoadedSourceMemberAuthority(value: LoadedSourceMemberAuthority): void {
    if (!value || typeof value !== "object" || !LOADED.has(value)) {
        throw new HardenedSemanticError("HARDENED_SOURCE_MEMBER_AUTHORITY_INSTANCE",
            "source member authority was not produced by the authenticated loader");
    }
}

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const [sourcePath, targetPath, mappingPath, lockPath] = process.argv.slice(2);
if (![sourcePath, targetPath, mappingPath, lockPath].every(value => typeof value === "string" && value.length > 0)) {
    process.stderr.write("usage: node tools/generate-capability-map.cjs <source-census> <target-capabilities> <mapping-output> <lock-output>\n");
    process.exit(2);
}

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(file) {
    const bytes = fs.readFileSync(file);
    const text = bytes.toString("utf8");
    if (Buffer.from(text, "utf8").compare(bytes) !== 0) {
        throw new Error(`${file} is not canonical UTF-8`);
    }
    return { bytes, value: JSON.parse(text) };
}

function canonical(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
    }
    throw new Error("mapping contains a non-JSON value");
}

function exactTarget(sourceQName, obligations) {
    const parts = sourceQName.split(".");
    const targetExport = parts.pop();
    const targetModule = `src/layaAir/${parts.join("/")}/${targetExport}.ts`;
    const matches = obligations.filter(item => item.obligation.module === targetModule
        && item.obligation.export === targetExport);
    if (matches.length > 1) throw new Error(`ambiguous target obligation for ${sourceQName}`);
    return matches.length === 1 ? matches[0] : null;
}

function constructorArity(signature) {
    const match = /^new \((.*)\): [A-Za-z_$][A-Za-z0-9_$]*$/.exec(signature);
    if (!match) return null;
    const text = match[1].trim();
    if (text === "") return { minArgs: 0, maxArgs: 0 };
    const parts = [];
    let start = 0;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if ("([{<".includes(char)) depth += 1;
        else if (")]}>".includes(char)) depth -= 1;
        else if (char === "," && depth === 0) {
            parts.push(text.slice(start, index).trim());
            start = index + 1;
        }
        if (depth < 0) return null;
    }
    if (depth !== 0) return null;
    parts.push(text.slice(start).trim());
    if (parts.some(part => part === "" || part.startsWith("..."))) return null;
    const optional = parts.findIndex(part => /^[A-Za-z_$][A-Za-z0-9_$]*\?\s*:/.test(part));
    if (optional >= 0 && parts.slice(optional).some(part => !/^[A-Za-z_$][A-Za-z0-9_$]*\?\s*:/.test(part))) return null;
    return { minArgs: optional < 0 ? parts.length : optional, maxArgs: parts.length };
}

function targetMemberFor(sourceUse, sourceSignature, obligation) {
    if (sourceUse.context === "constructor") {
        const constructors = Array.isArray(obligation.constructors) ? obligation.constructors : [];
        const matches = constructors.filter(signature => {
            if (typeof signature !== "string") return false;
            const arity = constructorArity(signature);
            return arity && arity.minArgs === sourceSignature.minArgs && arity.maxArgs === sourceSignature.maxArgs;
        });
        if (matches.length !== 1 || sourceUse.member !== obligation.export) return null;
        return { name: sourceUse.member, kind: "constructor", scope: "static", signature: matches[0] };
    }
    const scope = sourceUse.context === "event-constant" || sourceUse.context === "static-member"
        ? "static" : "instance";
    const admittedKinds = sourceUse.access === "call" ? new Set(["method"])
        : sourceUse.access === "read" ? new Set(["get", "property"])
        : sourceUse.access === "write" ? new Set(["property", "set"])
        : new Set();
    const matches = (obligation.members || []).filter(member => member.name === sourceUse.member
        && member.scope === scope && admittedKinds.has(member.kind) && !member.name.startsWith("_"));
    return matches.length === 1 ? matches[0] : null;
}

const source = readJson(path.resolve(sourcePath));
const target = readJson(path.resolve(targetPath));
const sourceCapabilities = source.value && source.value.as3SourceCapabilities;
if (!sourceCapabilities || !Array.isArray(sourceCapabilities.apis) || !Array.isArray(sourceCapabilities.memberUses)) {
    throw new Error("source census lacks the closed as3SourceCapabilities section");
}
if (!target.value || target.value.schema !== "laya-authored-content-capabilities@1"
    || !Array.isArray(target.value.capabilities)) {
    throw new Error("target capability ledger has the wrong schema");
}

const obligations = [];
for (const capability of target.value.capabilities) {
    if (capability.status !== "typescript-obligation" || !Array.isArray(capability.obligations)) continue;
    for (const obligation of capability.obligations) obligations.push({ capabilityId: capability.id, obligation });
}

const mappings = [];
const mappedTypes = new Map();
for (const api of sourceCapabilities.apis) {
    if (api.classification !== "layaair-flash-api-bridge" || typeof api.qname !== "string") continue;
    const targetMatch = exactTarget(api.qname, obligations);
    if (!targetMatch) continue;
    if (!api.preserve || api.preserve.apiName !== true || api.preserve.signature !== true
        || !Array.isArray(api.roles) || api.roles.length === 0) {
        throw new Error(`source API lacks preservation authority: ${api.qname}`);
    }
    const roles = [...new Set(api.roles)].sort();
    const entry = {
        sourceQName: api.qname,
        sourceRoles: roles,
        sourceMember: null,
        targetCapabilityId: targetMatch.capabilityId,
        targetModule: targetMatch.obligation.module,
        targetExport: targetMatch.obligation.export,
        targetKind: targetMatch.obligation.kind,
        targetSignature: targetMatch.obligation.signature,
        targetMember: null,
    };
    mappings.push(entry);
    mappedTypes.set(api.qname, targetMatch);
}

const memberKeys = new Set();
for (const use of sourceCapabilities.memberUses) {
    if (use.classification !== "layaair-flash-api-bridge" || use.preserveNameAndSignature !== true
        || typeof use.qname !== "string" || !mappedTypes.has(use.qname)
        || use.access !== "call" || !Array.isArray(use.signatures) || use.signatures.length === 0) continue;
    const targetMatch = mappedTypes.get(use.qname);
    const ordinaryTargetMember = use.context === "constructor"
        ? null : targetMemberFor(use, null, targetMatch.obligation);
    if (use.context !== "constructor" && !ordinaryTargetMember) continue;
    for (const signature of use.signatures) {
        if (!signature || typeof signature.signature !== "string" || !Number.isInteger(signature.minArgs)
            || !Number.isInteger(signature.maxArgs) || signature.minArgs < 0 || signature.maxArgs < signature.minArgs) {
            throw new Error(`invalid source member signature for ${use.qname}.${use.member}`);
        }
        const targetMember = ordinaryTargetMember || targetMemberFor(use, signature, targetMatch.obligation);
        if (!targetMember) continue;
        const key = [use.qname, use.access, use.member, signature.signature].join("\u0000");
        if (memberKeys.has(key)) continue;
        memberKeys.add(key);
        mappings.push({
            sourceQName: use.qname,
            sourceRoles: [use.context || "instance-member"].sort(),
            sourceMember: {
                name: use.member,
                access: use.access,
                minArgs: signature.minArgs,
                maxArgs: signature.maxArgs,
                signature: signature.signature,
            },
            targetCapabilityId: targetMatch.capabilityId,
            targetModule: targetMatch.obligation.module,
            targetExport: targetMatch.obligation.export,
            targetKind: targetMatch.obligation.kind,
            targetSignature: targetMatch.obligation.signature,
            targetMember: {
                name: targetMember.name,
                kind: targetMember.kind,
                scope: targetMember.scope,
                signature: targetMember.signature,
            },
        });
    }
}

mappings.sort((left, right) => {
    const a = [left.sourceQName, left.sourceMember ? left.sourceMember.access : "", left.sourceMember ? left.sourceMember.name : "",
        left.sourceMember ? left.sourceMember.signature : ""].join("\u0000");
    const b = [right.sourceQName, right.sourceMember ? right.sourceMember.access : "", right.sourceMember ? right.sourceMember.name : "",
        right.sourceMember ? right.sourceMember.signature : ""].join("\u0000");
    return a.localeCompare(b);
});

const mappingBytes = `${canonical({ schema: "as3-source-to-laya-capability-map@1", mappings })}\n`;
const lock = {
    schema: "bleach-local-as3-authority-lock@1",
    upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
    typeScriptVersion: "4.9.5",
    sourceCensusSha256: sha256(source.bytes),
    targetCapabilitiesSha256: sha256(target.bytes),
    capabilityMappingSha256: sha256(mappingBytes),
    mappedTypeCount: mappings.filter(item => item.sourceMember === null).length,
    mappedMemberCount: mappings.filter(item => item.sourceMember !== null).length,
};

fs.mkdirSync(path.dirname(path.resolve(mappingPath)), { recursive: true });
fs.writeFileSync(path.resolve(mappingPath), mappingBytes, { encoding: "utf8", flag: "w" });
fs.writeFileSync(path.resolve(lockPath), `${canonical(lock)}\n`, { encoding: "utf8", flag: "w" });
process.stdout.write(`generated ${lock.mappedTypeCount} type and ${lock.mappedMemberCount} member mappings\n`);

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
    const diskBytes = fs.readFileSync(file);
    const diskText = diskBytes.toString("utf8");
    if (Buffer.from(diskText, "utf8").compare(diskBytes) !== 0) {
        throw new Error(`${file} is not canonical UTF-8`);
    }
    const text = diskText.replace(/\r\n?/g, "\n");
    const bytes = Buffer.from(text, "utf8");
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
    const matches = obligations.filter(item => item.obligation.export === targetExport
        && (STRICT_SOURCE_QNAMES.has(sourceQName) || item.obligation.module === targetModule));
    if (matches.length > 1) throw new Error(`ambiguous target obligation for ${sourceQName}`);
    return matches.length === 1 && matches[0].obligation.module === targetModule ? matches[0] : null;
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

function callableArity(signature) {
    const match = /^\((.*)\) => .+$/.exec(signature);
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

function sourceArity(sourceUse, signature) {
    if (sourceUse.access === "read") return { minArgs: 0, maxArgs: 0 };
    if (sourceUse.access === "write") return { minArgs: 1, maxArgs: 1 };
    return { minArgs: signature.minArgs, maxArgs: signature.maxArgs };
}

const HELD_BEHAVIORAL_MEMBERS = new Set(["getBounds", "getRect", "scrollRect"]);
const GEOMETRY_QNAMES = new Set(["flash.geom.Point", "flash.geom.Rectangle"]);
const BITMAP_QNAMES = new Set(["flash.display.Bitmap", "flash.display.BitmapData", "flash.display.BitmapDataChannel"]);
const BITMAP_SOURCE_QNAMES = new Set([...BITMAP_QNAMES, "flash.display.PixelSnapping"]);
const TEXT_FILTER_QNAMES = new Set(["flash.text.TextField", "flash.text.TextFormat", "flash.filters.BitmapFilter",
    "flash.filters.BlurFilter", "flash.filters.ColorMatrixFilter", "flash.filters.DropShadowFilter", "flash.filters.GlowFilter"]);
const STRICT_SOURCE_QNAMES = new Set([...BITMAP_SOURCE_QNAMES, ...TEXT_FILTER_QNAMES]);
const BITMAP_ALLOWED_MEMBERS = Object.freeze({
    "flash.display.Bitmap": new Set(["bitmapData", "smoothing"]),
    "flash.display.BitmapData": new Set(["BitmapData", "clone", "copyChannel", "copyPixels", "dispose", "fillRect",
        "getColorBoundsRect", "getPixel", "getPixel32", "height", "lock", "rect", "threshold", "unlock", "width"]),
    "flash.display.BitmapDataChannel": new Set(["ALPHA", "RED"]),
});
const BITMAP_CHANNEL_VALUES = Object.freeze({ ALPHA: 8, RED: 1 });
const TEXT_FILTER_ALLOWED_MEMBERS = Object.freeze({
    "flash.text.TextField": new Set(["TextField", "addEventListener", "appendText", "getCharBoundaries",
        "getCharIndexAtPoint", "getLineLength", "getLineOffset", "getTextFormat", "removeEventListener", "replaceText",
        "setSelection", "setTextFormat"]),
    "flash.filters.BlurFilter": new Set(["BlurFilter"]),
    "flash.filters.DropShadowFilter": new Set(["DropShadowFilter"]),
    "flash.filters.GlowFilter": new Set(["GlowFilter"]),
});
const EXACT_TEXT_FIELD_MEMBERS = new Set(["appendText", "getCharBoundaries", "getCharIndexAtPoint", "getLineLength",
    "getLineOffset", "getTextFormat", "replaceText", "setTextFormat"]);

function exactCallMember(qname, name) {
    return BITMAP_QNAMES.has(qname) || (qname === "flash.text.TextField" && EXACT_TEXT_FIELD_MEMBERS.has(name))
        || ["flash.filters.BlurFilter", "flash.filters.DropShadowFilter", "flash.filters.GlowFilter"].includes(qname);
}

function admittedBitmapMember(use) {
    const members = BITMAP_ALLOWED_MEMBERS[use.qname];
    if (!members || !members.has(use.member)) return false;
    if (use.qname === "flash.display.BitmapDataChannel") {
        return use.context === "static-member" && use.access === "read";
    }
    if (use.qname === "flash.display.Bitmap") {
        return ["read", "write"].includes(use.access);
    }
    return use.member === "BitmapData" ? use.context === "constructor" && use.access === "call"
        : ["height", "rect", "width"].includes(use.member) ? use.access === "read" : use.access === "call";
}

function admittedTextFilterMember(use) {
    const members = TEXT_FILTER_ALLOWED_MEMBERS[use.qname];
    if (!members || !members.has(use.member) || use.access !== "call") return false;
    return use.qname === "flash.text.TextField" ? use.member === "TextField"
        ? use.context === "constructor" : use.context === "instance-member"
        : use.context === "constructor" && use.member === use.qname.split(".").pop();
}

function splitParameters(text) {
    if (text.trim() === "") return [];
    const result = [];
    let start = 0;
    let depth = 0;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if ("([{<".includes(char)) depth += 1;
        else if (")]}>".includes(char)) depth -= 1;
        else if (char === "," && depth === 0) {
            result.push(text.slice(start, index).trim());
            start = index + 1;
        }
        if (depth < 0) return null;
    }
    if (depth !== 0) return null;
    result.push(text.slice(start).trim());
    return result;
}

function canonicalSourceType(type, bitmapNumeric = false) {
    const local = type.split(".").pop();
    return ({ Number: "number", Boolean: "boolean", String: "string", ...(bitmapNumeric ? { int: "number", uint: "number" } : {}) })[local] || local;
}

function targetTypeDescriptor(type) {
    const parts = type.split("|").map(part => part.trim());
    const withoutNullable = parts.filter(part => part !== "null");
    if (withoutNullable.length !== 1 || parts.some(part => part === "")) return null;
    return { type: withoutNullable[0].split(".").pop(), nullable: parts.includes("null") };
}

const NON_NULLABLE_SOURCE_TYPES = new Set(["number", "boolean", "int", "uint", "void"]);

function exactSourceTargetType(sourceType, targetType) {
    return targetType !== null && sourceType === targetType.type
        && (!targetType.nullable || !NON_NULLABLE_SOURCE_TYPES.has(sourceType));
}

function sourceCallableTypes(signature, bitmapNumeric = false) {
    const callable = /^public (?:native )?function (?:[A-Za-z_$][A-Za-z0-9_$]*|(?:get|set) [A-Za-z_$][A-Za-z0-9_$]*)\((.*)\)\s*:\s*([^;\s]+)\s*;?$/.exec(signature);
    const constructor = /^public function [A-Za-z_$][A-Za-z0-9_$]*\((.*)\)$/.exec(signature);
    const match = callable || constructor;
    if (!match) return null;
    const parts = splitParameters(match[1]);
    if (!parts) return null;
    const parameters = parts.map(part => {
        const parameter = /^(?:\.\.\.)?[A-Za-z_$][A-Za-z0-9_$]*\s*:\s*([^=\s]+)(?:\s*=.*)?$/.exec(part);
        return parameter ? canonicalSourceType(parameter[1], bitmapNumeric) : null;
    });
    if (parameters.some(type => type === null)) return null;
    return { parameters, returnType: callable ? canonicalSourceType(callable[2], bitmapNumeric) : null };
}

function targetCallableTypes(signature) {
    const callable = /^\((.*)\) => (.+)$/.exec(signature);
    const constructor = /^new \((.*)\): ([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(signature);
    const match = callable || constructor;
    if (!match) return null;
    const parts = splitParameters(match[1]);
    if (!parts) return null;
    const parameters = parts.map(part => {
        const parameter = /^[A-Za-z_$][A-Za-z0-9_$]*\?*\s*:\s*(.+)$/.exec(part);
        return parameter ? targetTypeDescriptor(parameter[1]) : null;
    });
    const returnType = targetTypeDescriptor(match[2]);
    if (parameters.some(type => type === null) || returnType === null) return null;
    return { parameters, returnType };
}

function exactCallableTypes(sourceSignature, targetSignature, constructor = false, bitmapNumeric = false) {
    const source = sourceCallableTypes(sourceSignature, bitmapNumeric);
    const target = targetCallableTypes(targetSignature);
    return source !== null && target !== null
        && (constructor || (source.returnType !== null && exactSourceTargetType(source.returnType, target.returnType)))
        && source.parameters.length === target.parameters.length
        && source.parameters.every((type, index) => exactSourceTargetType(type, target.parameters[index]));
}

function sourcePropertyType(signature, access, bitmapNumeric = false) {
    const variable = /^public (?:static )?(?:const|var) [A-Za-z_$][A-Za-z0-9_$]*:([^;\s]+)(?:\s*=\s*[^;]+)?;$/.exec(signature);
    if (variable) return canonicalSourceType(variable[1], bitmapNumeric);
    const callable = sourceCallableTypes(signature, bitmapNumeric);
    if (!callable) return null;
    return access === "write" ? callable.parameters[0] || null : callable.returnType;
}

function exactOwnedSourceMetadata(sourceUse, signature, targetExport) {
    if (!exactCallMember(sourceUse.qname, sourceUse.member)) return true;
    const constructor = sourceUse.member === targetExport;
    const expectedKind = constructor ? "constructor"
        : sourceUse.qname === "flash.display.BitmapDataChannel" ? "const"
            : sourceUse.access === "call" ? "method" : sourceUse.access === "read" ? "get" : "set";
    const callable = sourceCallableTypes(signature.signature, true);
    const expectedReturn = constructor ? targetExport
        : sourceUse.qname === "flash.display.BitmapDataChannel"
            ? sourcePropertyType(signature.signature, sourceUse.access, true)
            : sourceUse.access === "write" ? "void" : callable && callable.returnType;
    return sourceUse.receiverType === sourceUse.qname && signature.declaredBy === sourceUse.qname
        && signature.kind === expectedKind && signature.static === (sourceUse.qname === "flash.display.BitmapDataChannel")
        && typeof signature.returnType === "string"
        && canonicalSourceType(signature.returnType, true) === expectedReturn;
}

function exactBitmapChannelConstant(sourceUse, sourceSignature, targetMember) {
    const expected = BITMAP_CHANNEL_VALUES[sourceUse.member];
    const source = /^public static const ([A-Za-z_$][A-Za-z0-9_$]*):uint\s*=\s*([0-9]+);$/.exec(sourceSignature.signature);
    return expected !== undefined && source !== null && source[1] === sourceUse.member
        && Number(source[2]) === expected && targetMember.kind === "property" && targetMember.scope === "static"
        && targetMember.readonly === true && targetMember.signature === String(expected);
}

function targetMemberFor(sourceUse, sourceSignature, obligation) {
    if (sourceUse.context === "constructor") {
        const constructors = Array.isArray(obligation.constructors) ? obligation.constructors : [];
        const matches = constructors.filter(signature => {
            if (typeof signature !== "string") return false;
            const arity = constructorArity(signature);
            return arity && arity.minArgs === sourceSignature.minArgs && arity.maxArgs === sourceSignature.maxArgs;
        });
        if (STRICT_SOURCE_QNAMES.has(sourceUse.qname) && constructors.length !== 1) {
            throw new Error(`owned target constructor identity is ambiguous: ${sourceUse.qname}`);
        }
        if (matches.length !== 1 || sourceUse.member !== obligation.export) return null;
        if ((GEOMETRY_QNAMES.has(sourceUse.qname) || exactCallMember(sourceUse.qname, sourceUse.member))
            && !exactCallableTypes(sourceSignature.signature, matches[0], true,
                exactCallMember(sourceUse.qname, sourceUse.member))) return null;
        return { name: sourceUse.member, kind: "constructor", scope: "static", signature: matches[0] };
    }
    const scope = sourceUse.context === "event-constant" || sourceUse.context === "static-member"
        ? "static" : "instance";
    const admittedKinds = sourceUse.access === "call" ? new Set(["method"])
        : sourceUse.access === "read" ? new Set(["get", "get+set", "property"])
        : sourceUse.access === "write" ? new Set(["get+set", "property", "set"])
        : new Set();
    const named = (obligation.members || []).filter(member => member.name === sourceUse.member);
    if (STRICT_SOURCE_QNAMES.has(sourceUse.qname) && named.length !== 1) {
        throw new Error(`owned target member identity is ambiguous: ${sourceUse.qname}.${sourceUse.member}`);
    }
    const matches = named.filter(member => member.name === sourceUse.member
        && member.scope === scope && admittedKinds.has(member.kind) && !member.name.startsWith("_")
        && (sourceUse.access !== "write" || member.readonly !== true));
    if (matches.length !== 1) return null;
    if (sourceUse.qname === "flash.display.BitmapDataChannel") {
        if (!exactBitmapChannelConstant(sourceUse, sourceSignature, matches[0])) return null;
    } else if (sourceUse.access === "call" && (GEOMETRY_QNAMES.has(sourceUse.qname)
        || exactCallMember(sourceUse.qname, sourceUse.member))) {
        const targetArity = callableArity(matches[0].signature);
        if (!targetArity || targetArity.minArgs !== sourceSignature.minArgs
            || targetArity.maxArgs !== sourceSignature.maxArgs) return null;
        if (!exactCallableTypes(sourceSignature.signature, matches[0].signature, false,
            exactCallMember(sourceUse.qname, sourceUse.member))) return null;
    } else if (sourceUse.access !== "call" && (GEOMETRY_QNAMES.has(sourceUse.qname) || BITMAP_QNAMES.has(sourceUse.qname))) {
        const sourceType = sourcePropertyType(sourceSignature.signature, sourceUse.access, BITMAP_QNAMES.has(sourceUse.qname));
        if (sourceType === null || !exactSourceTargetType(sourceType,
            targetTypeDescriptor(matches[0].signature))) return null;
    }
    return matches[0];
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

for (const qname of STRICT_SOURCE_QNAMES) {
    if (sourceCapabilities.apis.filter(api => api && api.qname === qname).length !== 1) {
        throw new Error(`owned source API identity is absent or ambiguous: ${qname}`);
    }
}
const bitmapUseGroups = new Map();
for (const use of sourceCapabilities.memberUses.filter(item => item && (BITMAP_QNAMES.has(item.qname)
    ? admittedBitmapMember(item) : TEXT_FILTER_QNAMES.has(item.qname) && admittedTextFilterMember(item)))) {
    const groupKey = [use.qname, use.member, use.access, use.context].join("\u0000");
    if (!bitmapUseGroups.has(groupKey)) bitmapUseGroups.set(groupKey, []);
    bitmapUseGroups.get(groupKey).push(use);
}
for (const [groupKey, uses] of bitmapUseGroups) {
    const argumentCounts = new Set();
    let signatureTuple = null;
    for (const use of uses) {
        const argumentIdentity = canonical(use.argumentCount);
        if (argumentCounts.has(argumentIdentity) || use.classification !== "layaair-flash-api-bridge"
            || use.preserveNameAndSignature !== true || use.receiverType !== use.qname
            || !Array.isArray(use.signatures) || use.signatures.length !== 1) {
            throw new Error(`bitmap source member evidence is absent or ambiguous: ${groupKey}`);
        }
        argumentCounts.add(argumentIdentity);
        const signature = use.signatures[0];
        const signatureKeys = ["declaredBy", "kind", "maxArgs", "minArgs", "returnType", "signature", "static"];
        if (!signature || Object.keys(signature).sort().join("\u0000") !== signatureKeys.join("\u0000")) {
            throw new Error(`bitmap source signature tuple is invalid: ${groupKey}`);
        }
        const tuple = canonical(signature);
        if (signatureTuple !== null && signatureTuple !== tuple) {
            throw new Error(`bitmap source signature tuple is conflicting: ${groupKey}`);
        }
        signatureTuple = tuple;
    }
}

const targetCapabilityIds = new Set();
for (const capability of target.value.capabilities) {
    if (!capability || typeof capability.id !== "string" || targetCapabilityIds.has(capability.id)) {
        throw new Error("target capability identity is absent or ambiguous");
    }
    targetCapabilityIds.add(capability.id);
    for (const obligation of capability.obligations || []) {
        if (!obligation || !STRICT_SOURCE_QNAMES.has(`flash.${obligation.module?.split("/flash/")[1]?.replace(/\.ts$/, "").replaceAll("/", ".")}`)) continue;
        const constructors = Array.isArray(obligation.constructors) ? obligation.constructors : [];
        if (constructors.some(value => typeof value !== "string") || constructors.length > 1) {
            throw new Error(`owned target constructors are ambiguous: ${obligation.export}`);
        }
    }
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

const memberKeys = new Map();
for (const use of sourceCapabilities.memberUses) {
    const bitmapMember = BITMAP_QNAMES.has(use.qname);
    const textFilterMember = TEXT_FILTER_QNAMES.has(use.qname);
    if (use.classification !== "layaair-flash-api-bridge" || use.preserveNameAndSignature !== true
        || typeof use.qname !== "string" || !mappedTypes.has(use.qname)
        || !["call", "read", "write"].includes(use.access)
        || (use.access !== "call" && !GEOMETRY_QNAMES.has(use.qname) && !bitmapMember)
        || (bitmapMember && !admittedBitmapMember(use))
        || (textFilterMember && !admittedTextFilterMember(use))
        || use.qname === "flash.display.PixelSnapping"
        || HELD_BEHAVIORAL_MEMBERS.has(use.member)
        || !Array.isArray(use.signatures) || use.signatures.length === 0) continue;
    const targetMatch = mappedTypes.get(use.qname);
    for (const signature of use.signatures) {
        const arity = sourceArity(use, signature || {});
        if (!signature || typeof signature.signature !== "string" || !Number.isInteger(arity.minArgs)
            || !Number.isInteger(arity.maxArgs) || arity.minArgs < 0 || arity.maxArgs < arity.minArgs
            || !exactOwnedSourceMetadata(use, signature, targetMatch.obligation.export)) {
            continue;
        }
        const targetMember = targetMemberFor(use, { ...arity, signature: signature.signature }, targetMatch.obligation);
        if (!targetMember) continue;
        const key = [use.qname, use.access, use.member, signature.signature].join("\u0000");
        if (memberKeys.has(key)) {
            if (STRICT_SOURCE_QNAMES.has(use.qname) && memberKeys.get(key) !== use.context) {
                throw new Error(`owned source member mapping identity is ambiguous: ${use.qname}.${use.member}`);
            }
            continue;
        }
        memberKeys.set(key, use.context);
        const sourceMember = {
            name: use.member,
            access: use.access,
            minArgs: arity.minArgs,
            maxArgs: arity.maxArgs,
            signature: signature.signature,
        };
        mappings.push({
            sourceQName: use.qname,
            sourceRoles: [use.context || "instance-member"].sort(),
            sourceMember,
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

"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { compareUtf8, stringify } = require("./hardened-corpus/canonical");

const MAX_MAP_BYTES = 64 * 1024 * 1024;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_RESULT_BYTES = 4 * 1024 * 1024;
const WORKER_TIMEOUT_MS = 8000;
const BUILTINS = new Set([
    "*", "Array", "Boolean", "Class", "Date", "Error", "Function", "Namespace", "Number", "Object",
    "RegExp", "String", "XML", "XMLList", "int", "uint", "void",
]);

const [typeMapArgument, outputArgument, sourceRepositoryArgument, workerArgument,
    sourceCensusArgument, expectedSourceCensusSha256] = process.argv.slice(2);
if (!typeMapArgument || !outputArgument || !sourceRepositoryArgument || !workerArgument
    || !sourceCensusArgument || !/^[0-9a-f]{64}$/.test(expectedSourceCensusSha256 || "")) {
    process.stderr.write("usage: node tools/generate-local-member-map.cjs <local-type-map> <output> <source-repository> <declaration-worker> <source-census> <expected-source-census-sha256>\n");
    process.exit(2);
}

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readCanonicalFile(fileArgument, maxBytes, label, allowBom = false) {
    const lexical = path.resolve(fileArgument);
    const stat = fs.lstatSync(lexical, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > BigInt(maxBytes)
        || fs.realpathSync.native(lexical) !== lexical) {
        throw new Error(`${label} must be one canonical ordinary bounded file`);
    }
    const bytes = fs.readFileSync(lexical);
    const after = fs.lstatSync(lexical, { bigint: true });
    if (stat.dev !== after.dev || stat.ino !== after.ino || stat.size !== after.size
        || stat.mtimeNs !== after.mtimeNs || BigInt(bytes.length) !== stat.size) {
        throw new Error(`${label} changed while it was read`);
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const expected = allowBom && bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
        ? bytes.subarray(3) : bytes;
    if (Buffer.from(text, "utf8").compare(expected) !== 0) throw new Error(`${label} must be exact UTF-8`);
    return { lexical, bytes, text };
}

const sourceRepository = path.resolve(sourceRepositoryArgument);
const sourceStat = fs.lstatSync(sourceRepository);
if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()
    || fs.realpathSync.native(sourceRepository) !== sourceRepository) {
    throw new Error("source repository must be one canonical ordinary directory");
}
const worker = readCanonicalFile(workerArgument, MAX_MAP_BYTES, "declaration worker");
const workerSha256 = sha256(worker.bytes);
const typeMapFile = readCanonicalFile(typeMapArgument, MAX_MAP_BYTES, "local type map");
const typeMapText = typeMapFile.text.replace(/\r\n?/g, "\n");
const typeMap = JSON.parse(typeMapText);
const applicationProfile = typeMap && typeMap.schema === "as3-application-local-type-map@1";
const workerTimeoutMs = applicationProfile ? 60000 : WORKER_TIMEOUT_MS;
if (!typeMap || (!applicationProfile && typeMap.schema !== "bleach-local-as3-type-map@2") || !Array.isArray(typeMap.entries)
    || typeMap.entryCount !== typeMap.entries.length || `${stringify(typeMap)}\n` !== typeMapText) {
    throw new Error("local type map must be the exact canonical v2 authority");
}
const localTypeMapSha256 = sha256(Buffer.from(typeMapText, "utf8"));
const byIdentity = new Map(typeMap.entries.map(entry => [`${entry.module}\u0000${entry.qname}`, entry]));
const sourceCensusFile = readCanonicalFile(sourceCensusArgument, MAX_MAP_BYTES, "source capability census");
const sourceCensusText = sourceCensusFile.text.replace(/\r\n?/g, "\n");
const sourceCensusSha256 = sha256(Buffer.from(sourceCensusText, "utf8"));
if (sourceCensusSha256 !== expectedSourceCensusSha256) {
    throw new Error("source capability census differs from its expected canonical digest");
}
const sourceCensus = JSON.parse(sourceCensusText);
if (!sourceCensus || sourceCensus.schema !== "swf-capability-census@1"
    || !sourceCensus.as3SourceCapabilities || !Array.isArray(sourceCensus.as3SourceCapabilities.apis)
    || `${stringify(sourceCensus)}\n` !== sourceCensusText) {
    throw new Error("source capability census must be the exact canonical v1 authority");
}
const flashDefinitions = new Set();
const flashApis = new Set();
for (const [index, api] of sourceCensus.as3SourceCapabilities.apis.entries()) {
    if (!api || typeof api !== "object" || typeof api.qname !== "string"
        || (!/^flash(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(api.qname) && api.qname !== "trace")
        || !Array.isArray(api.roles) || api.roles.some(role => typeof role !== "string")
        || new Set(api.roles).size !== api.roles.length || flashApis.has(api.qname)) {
        throw new Error(`source capability API ${index} has an invalid or duplicate definition`);
    }
    flashApis.add(api.qname);
    if (api.qname === "trace") {
        if (JSON.stringify(api.roles) !== '["global-function"]'
            || JSON.stringify(api.signatures) !== '["public native function trace(... rest) : void;"]')
            throw new Error("Global trace cannot create a declaration type");
        continue;
    }
    // Wildcard-resolution is the census-owned lexical authority. Package
    // functions are runtime values, never declaration types, even though the
    // census tracks their wildcard imports for call-site analysis.
    if ((api.roles.includes("wildcard-resolution") || (applicationProfile && api.roles.includes("import")))
        && !api.roles.includes("package-function")) {
        flashDefinitions.add(api.qname);
    }
}

function readSource(entry) {
    const lexical = path.resolve(sourceRepository, ...entry.sourcePath.split("/"));
    if (!lexical.startsWith(`${sourceRepository}${path.sep}`) || fs.realpathSync.native(lexical) !== lexical) {
        throw new Error(`source path escapes authority root: ${entry.sourcePath}`);
    }
    const file = readCanonicalFile(lexical, MAX_SOURCE_BYTES, `source ${entry.sourcePath}`, true);
    let text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    text = text.replace(/\r\n?/g, "\n");
    if (sha256(Buffer.from(text, "utf8")) !== entry.sourceContentSha256) {
        throw new Error(`source hash differs from local type authority: ${entry.sourcePath}`);
    }
    return text;
}

function runWorker(entry, content) {
    return new Promise((resolve, reject) => {
        const child = childProcess.fork(worker.lexical, [], {
            cwd: sourceRepository,
            execArgv: ["--max-old-space-size=256"],
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
        let stdoutBytes = 0;
        let stderrBytes = 0;
        child.stdout.on("data", chunk => { stdoutBytes += chunk.length; });
        child.stderr.on("data", chunk => { stderrBytes += chunk.length; });
        const timer = setTimeout(() => {
            child.kill();
            resolve({
                ok: false,
                error: `FRONTEND_RESOURCE_LIMIT: declaration worker timed out for ${entry.sourcePath}`,
                resourceLimit: true,
                workerSha256,
            });
        }, workerTimeoutMs);
        child.once("error", reject);
        child.once("message", message => {
            clearTimeout(timer);
            if (!message || message.workerSha256 !== workerSha256 || stdoutBytes !== 0 || stderrBytes !== 0) {
                child.kill();
                reject(new Error(`declaration worker violated its authenticated envelope: ${entry.sourcePath}`));
                return;
            }
            resolve(message);
        });
        child.send({
            sourcePath: entry.sourcePath,
            content,
            maxResultBytes: MAX_RESULT_BYTES,
            workerSha256,
        });
    });
}

function resolveQName(entry, extract, rawName, requiredKind = null) {
    if (BUILTINS.has(rawName)) return rawName;
    const vector = /^Vector\.<(.+)>$/.exec(rawName);
    if (vector) {
        const element = resolveQName(entry, extract, vector[1], null);
        return element === null ? null : `Vector.<${element}>`;
    }
    if (rawName === extract.qualifiedName.slice(extract.qualifiedName.lastIndexOf(".") + 1)
        || rawName === extract.qualifiedName) return extract.qualifiedName;
    const privateMatches = (extract.fileLocalClasses || []).filter(item => item.name === rawName);
    if (privateMatches.length) {
        if (privateMatches.length !== 1 || requiredKind === "interface") return null;
        return `FilePrivate(${entry.module}:${entry.sourcePath})::${privateMatches[0].name}`;
    }
    const localName = rawName.slice(rawName.lastIndexOf(".") + 1);
    const explicit = extract.imports.filter(item => !item.endsWith(".*")
        && item.slice(item.lastIndexOf(".") + 1) === localName);
    let candidates = explicit.length === 1 ? explicit.slice() : [];
    if (rawName.includes(".")) candidates.push(rawName);
    if (!rawName.includes(".")) candidates.push(extract.packageName ? `${extract.packageName}.${rawName}` : rawName);
    extract.imports.filter(item => item.endsWith(".*")).forEach(item => candidates.push(`${item.slice(0, -1)}${rawName}`));
    candidates = [...new Set(candidates)].filter(qname => {
        if (qname.startsWith("flash.")) return flashDefinitions.has(qname);
        const target = byIdentity.get(`${entry.module}\u0000${qname}`);
        return !!target && target.importable && target.typeKind !== "package"
            && entry.prerequisites.includes(target.nodeId)
            && (requiredKind === null || target.typeKind === requiredKind);
    });
    if (candidates.length !== 1) return null;
    if (candidates[0].startsWith("flash.")) return candidates[0];
    const target = byIdentity.get(`${entry.module}\u0000${candidates[0]}`);
    return target && (requiredKind === null || target.typeKind === requiredKind) ? target.qname : null;
}

function canonicalizeExtract(entry, extract) {
    if (extract.schema !== "as3-local-declaration-extract@1" || extract.sourceSha256 !== entry.sourceContentSha256
        || extract.qualifiedName !== entry.qname || extract.declarationKind !== entry.typeKind) {
        throw new Error(`declaration worker result disagrees with local type authority: ${entry.qname}`);
    }
    const baseNames = extract.extendsNames.map(name => resolveQName(entry, extract, name,
        extract.declarationKind === "class" ? "class" : "interface"));
    const interfaceNames = extract.implementsNames.map(name => resolveQName(entry, extract, name, "interface"));
    if (baseNames.includes(null) || interfaceNames.includes(null)) return { holdCode: "LOCAL_MEMBER_TYPE_RESOLUTION" };
    const members = [];
    for (const member of extract.members) {
        const parameters = member.parameters.map(parameter => ({
            name: parameter.name,
            type: resolveQName(entry, extract, parameter.type, null),
            optional: parameter.optional,
            rest: parameter.rest,
        }));
        const returnType = member.returnType === null ? null : resolveQName(entry, extract, member.returnType, null);
        const fieldType = member.fieldType === null ? null : resolveQName(entry, extract, member.fieldType, null);
        if (parameters.some(parameter => parameter.type === null) || (member.returnType !== null && returnType === null)
            || (member.fieldType !== null && fieldType === null)) return { holdCode: "LOCAL_MEMBER_TYPE_RESOLUTION" };
        members.push({
            kind: member.kind, name: member.name, modifiers: member.modifiers,
            namespaceName: member.namespaceName, parameters, returnType, fieldType, readonly: member.readonly,
        });
    }
    let packageInitializer = null;
    if (entry.typeKind === "package" && members.length === 1 && members[0].kind === "field") {
        const raw = extract.packageInitializer;
        if (!raw || raw.kind !== "new" || raw.argumentCount !== 0 || typeof raw.typeName !== "string") {
            return { holdCode: "LOCAL_PACKAGE_INITIALIZER" };
        }
        const targetQName = resolveQName(entry, extract, raw.typeName, "class");
        if (targetQName === null || members[0].fieldType !== targetQName) {
            return { holdCode: "LOCAL_PACKAGE_INITIALIZER" };
        }
        packageInitializer = { kind: "new", targetQName, argumentCount: 0 };
    } else if (extract.packageInitializer !== null) {
        return { holdCode: "LOCAL_PACKAGE_INITIALIZER" };
    }
    return {
        holdCode: null,
        declaration: {
            ...(extract.finalClass === true ? {finalClass:true} : {}),
            baseQNames: baseNames,
            interfaceQNames: interfaceNames,
            members,
            packageInitializer,
            ...(extract.fileLocalClasses ? {fileLocalClasses:extract.fileLocalClasses} : {}),
        },
    };
}

function hold(entry, code, diagnostic) {
    return {
        module: entry.module, qname: entry.qname, nodeId: entry.nodeId,
        sourceContentSha256: entry.sourceContentSha256, typeKind: entry.typeKind,
        status: "held", holdCode: code, holdSha256: sha256(Buffer.from(diagnostic, "utf8")), declaration: null,
    };
}

async function main() {
    const entries = [];
    for (const entry of typeMap.entries) {
        const content = readSource(entry);
        const response = await runWorker(entry, content);
        if (!response.ok) {
            const match = /\b([A-Z][A-Z0-9_]+):/.exec(String(response.error));
            entries.push(hold(entry, match ? match[1] : "LOCAL_MEMBER_PARSE", String(response.error)));
            continue;
        }
        if (response.byteLength !== Buffer.byteLength(response.json, "utf8") || response.byteLength > MAX_RESULT_BYTES) {
            throw new Error(`declaration worker byte count is invalid: ${entry.sourcePath}`);
        }
        const extract = JSON.parse(response.json);
        const canonical = canonicalizeExtract(entry, extract);
        if (canonical.holdCode !== null) {
            entries.push(hold(entry, canonical.holdCode, `${canonical.holdCode}:${entry.qname}`));
            continue;
        }
        entries.push({
            module: entry.module, qname: entry.qname, nodeId: entry.nodeId,
            sourceContentSha256: entry.sourceContentSha256, typeKind: entry.typeKind,
            status: "complete", holdCode: null, holdSha256: null, declaration: canonical.declaration,
        });
    }
    entries.sort((left, right) => compareUtf8(`${left.module}\u0000${left.qname}`, `${right.module}\u0000${right.qname}`));
    const output = {
        schema: applicationProfile ? "as3-application-local-member-map@1" : "bleach-local-as3-member-map@2",
        sourceCensusSha256,
        localTypeMapSha256,
        declarationWorkerSha256: workerSha256,
        entryCount: entries.length,
        completeCount: entries.filter(entry => entry.status === "complete").length,
        heldCount: entries.filter(entry => entry.status === "held").length,
        entries,
    };
    const bytes = `${stringify(output)}\n`;
    const target = path.resolve(outputArgument);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "w" });
    process.stdout.write(`generated ${output.completeCount} complete and ${output.heldCount} held local declarations (${sha256(Buffer.from(bytes))})\n`);
}

main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});

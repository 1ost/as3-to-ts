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

const [typeMapArgument, outputArgument, sourceRepositoryArgument, workerArgument] = process.argv.slice(2);
if (!typeMapArgument || !outputArgument || !sourceRepositoryArgument || !workerArgument) {
    process.stderr.write("usage: node tools/generate-local-member-map.cjs <local-type-map> <output> <source-repository> <declaration-worker>\n");
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
const typeMap = JSON.parse(typeMapFile.text);
if (!typeMap || typeMap.schema !== "bleach-local-as3-type-map@2" || !Array.isArray(typeMap.entries)
    || typeMap.entryCount !== typeMap.entries.length || `${stringify(typeMap)}\n` !== typeMapFile.text) {
    throw new Error("local type map must be the exact canonical v2 authority");
}
const localTypeMapSha256 = sha256(typeMapFile.bytes);
const byIdentity = new Map(typeMap.entries.map(entry => [`${entry.module}\u0000${entry.qname}`, entry]));

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
            reject(new Error(`declaration worker timed out: ${entry.sourcePath}`));
        }, WORKER_TIMEOUT_MS);
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
    const localName = rawName.slice(rawName.lastIndexOf(".") + 1);
    const explicit = extract.imports.filter(item => !item.endsWith(".*")
        && item.slice(item.lastIndexOf(".") + 1) === localName);
    let candidates = explicit.length === 1 ? explicit.slice() : [];
    if (rawName.includes(".")) candidates.push(rawName);
    if (!rawName.includes(".") && extract.packageName !== "") candidates.push(`${extract.packageName}.${rawName}`);
    extract.imports.filter(item => item.endsWith(".*")).forEach(item => candidates.push(`${item.slice(0, -1)}${rawName}`));
    candidates = [...new Set(candidates)].filter(qname => {
        if (qname.startsWith("flash.")) return true;
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
    return {
        holdCode: null,
        declaration: {
            baseQNames: baseNames,
            interfaceQNames: interfaceNames,
            members,
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
        schema: "bleach-local-as3-member-map@1",
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

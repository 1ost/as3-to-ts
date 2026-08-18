"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { authenticateDependencyGraph } = require("./hardened-corpus/manifest");
const { compareUtf8, stringify } = require("./hardened-corpus/canonical");

const MAX_GRAPH_BYTES = 64 * 1024 * 1024;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const [graphArgument, outputArgument, sourceRepositoryArgument] = process.argv.slice(2);
if (!graphArgument || !outputArgument || !sourceRepositoryArgument) {
    process.stderr.write("usage: node tools/generate-local-type-map.cjs <dependency-graph> <output> <source-repository>\n");
    process.exit(2);
}

const sourceRepository = path.resolve(sourceRepositoryArgument);
const sourceRepositoryStat = fs.lstatSync(sourceRepository);
if (!sourceRepositoryStat.isDirectory() || sourceRepositoryStat.isSymbolicLink()
    || fs.realpathSync.native(sourceRepository) !== sourceRepository) {
    throw new Error("source repository must be one canonical ordinary directory");
}

function canonicalSourceSha256(repository, portablePath) {
    const lexical = path.resolve(repository, ...portablePath.split("/"));
    const root = repository;
    if (!lexical.startsWith(`${root}${path.sep}`) || fs.realpathSync.native(lexical) !== lexical) {
        throw new Error(`source path is not a canonical descendant: ${portablePath}`);
    }
    const before = fs.lstatSync(lexical, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.size > BigInt(MAX_SOURCE_BYTES)) {
        throw new Error(`source must be one canonical ordinary bounded file: ${portablePath}`);
    }
    const bytes = fs.readFileSync(lexical);
    const after = fs.lstatSync(lexical, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
        || before.mtimeNs !== after.mtimeNs || BigInt(bytes.length) !== before.size) {
        throw new Error(`source changed while it was read: ${portablePath}`);
    }
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (_error) {
        throw new Error(`source must be exact UTF-8: ${portablePath}`);
    }
    const decodedBytes = Buffer.from(text, "utf8");
    const expectedBytes = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
        ? bytes.subarray(3) : bytes;
    if (decodedBytes.compare(expectedBytes) !== 0) throw new Error(`source must be exact UTF-8: ${portablePath}`);
    return sha256(Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8"));
}

function sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readGraph(argument) {
    const lexical = path.resolve(argument);
    const stat = fs.lstatSync(lexical);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_GRAPH_BYTES
        || fs.realpathSync.native(lexical) !== lexical) {
        throw new Error("dependency graph must be one canonical ordinary bounded file");
    }
    const bytes = fs.readFileSync(lexical);
    const text = bytes.toString("utf8");
    if (Buffer.from(text, "utf8").compare(bytes) !== 0) {
        throw new Error("dependency graph must be exact UTF-8");
    }
    if (text.startsWith("\uFEFF")) throw new Error("dependency graph must not contain a UTF-8 BOM");
    return { bytes: Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8"), value: JSON.parse(text) };
}

function requireString(value, label) {
    if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a nonempty string`);
    return value;
}

const graph = readGraph(graphArgument);
const authenticated = authenticateDependencyGraph(graph.value);
const identities = new Set();
const entries = authenticated.semanticGraph.nodes
    .filter(node => node.node_kind === "as3_type" && (node.module === "application" || node.module === "bootstrap"))
    .map(node => {
        const qname = requireString(node.qname, `node ${node.node_id} qname`);
        const localIdentity = `${node.module}\u0000${qname}`;
        const importable = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(qname);
        if (/[\u0000-\u001f\u007f]/.test(qname) || identities.has(localIdentity)) {
            throw new Error(`invalid or duplicate local type identity: ${node.module}:${qname}`);
        }
        identities.add(localIdentity);
        if (!Number.isInteger(node.topological_level) || node.topological_level < 0
            || !Array.isArray(node.prerequisites) || !["class", "interface", "package"].includes(node.type_kind)) {
            throw new Error(`local type node has an invalid kind, level, or prerequisite set: ${qname}`);
        }
        return {
            componentId: requireString(node.component_id, `${qname} componentId`),
            graphSourceSha256: requireString(node.source_sha256, `${qname} graphSourceSha256`),
            importable,
            module: node.module,
            nodeId: requireString(node.node_id, `${qname} nodeId`),
            prerequisites: node.prerequisites.slice(),
            qname,
            sourcePath: requireString(node.source_path, `${qname} sourcePath`),
            sourceContentSha256: canonicalSourceSha256(sourceRepository,
                requireString(node.source_path, `${qname} sourcePath`)),
            targetPath: requireString(node.target_path, `${qname} targetPath`),
            topologicalLevel: node.topological_level,
            typeKind: node.type_kind,
        };
    })
    .sort((left, right) => compareUtf8(`${left.module}\u0000${left.qname}`, `${right.module}\u0000${right.qname}`));

const output = {
    dependencyGraphRawSha256: sha256(graph.bytes),
    dependencyGraphSemanticSha256: authenticated.sha256,
    entries,
    entryCount: entries.length,
    schema: "bleach-local-as3-type-map@2",
    sourceManifestSha256: authenticated.semanticGraph.sourceManifestSha256,
};
const bytes = `${stringify(output)}\n`;
const target = path.resolve(outputArgument);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, bytes, { encoding: "utf8", flag: "w" });
process.stdout.write(`generated ${entries.length} authenticated local type entries (${sha256(bytes)})\n`);

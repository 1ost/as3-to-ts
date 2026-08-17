import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import ts49 = require("typescript-4-9");
import { CliError, errorMessage } from "./errors";
import { discoverInputs, portableCollisionKey, readInput } from "./inputs";
import { parseIsolated } from "./isolated-parser";
import { HELP, parseArguments, TOOL_VERSION } from "./options";
import { loadTranspileAuthority } from "./authority";
import { adaptNormalizedParserAst } from "../hardened/adapter";
import type { NormalizedParserAst } from "../hardened/contracts";
import { emitSemanticProgram } from "../hardened/emitter";
import {
    abandon,
    preparePublication,
    publish,
    type Publication,
    writeArtifact,
} from "./publication";

interface Io {
    stdout: Pick<NodeJS.WriteStream, "write">;
    stderr: Pick<NodeJS.WriteStream, "write">;
}

interface ManifestFile {
    sourcePath: string;
    astPath: string;
    sourceBytes: number;
    sourceSha256: string;
    astBytes: number;
    astSha256: string;
}

interface TranspiledManifestFile {
    sourcePath: string;
    typescriptPath: string;
    sourceBytes: number;
    sourceSha256: string;
    normalizedAstSha256: string;
    normalizedFingerprintSha256: string;
    typescriptBytes: number;
    typescriptSha256: string;
}

function sha256(data: string | Buffer): string {
    return createHash("sha256").update(data).digest("hex");
}

function astPathFor(sourcePath: string): string {
    return `ast/${sourcePath.replace(/\.as$/i, ".ast.json")}`;
}

async function execute(argv: readonly string[], io: Io): Promise<number> {
    const parsed = parseArguments(argv);
    if (parsed.mode === "help") {
        io.stdout.write(HELP);
        return 0;
    }
    if (parsed.mode === "version") {
        io.stdout.write(`${TOOL_VERSION}\n`);
        return 0;
    }

    const { options } = parsed;
    const inputs = discoverInputs(options.sourceDirectory, options.limits);
    const transpileAuthority = options.operation === "transpile"
        ? loadTranspileAuthority(options.sourceCensusPath, options.targetCapabilitiesPath)
        : null;
    let publication: Publication | undefined;
    try {
        publication = preparePublication(options.outputDirectory, inputs.root);
        const manifestFiles: ManifestFile[] = [];
        const transpiledFiles: TranspiledManifestFile[] = [];
        const outputKeys = new Set<string>();
        let totalOutputBytes = 0;

        for (const file of inputs.files) {
            const source = readInput(file);
            const parsedFile = await parseIsolated(file.portablePath, source.content, options.limits,
                options.operation === "transpile" ? "normalized" : "legacy");
            if (options.operation === "parse") {
                totalOutputBytes += parsedFile.byteLength;
                if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                    throw new CliError("serialized AST set exceeds --max-total-output-bytes", 5);
                }
                const astPath = astPathFor(file.portablePath);
                writeArtifact(publication, astPath, parsedFile.json);
                manifestFiles.push({
                    sourcePath: file.portablePath,
                    astPath,
                    sourceBytes: source.bytes.byteLength,
                    sourceSha256: sha256(source.bytes),
                    astBytes: parsedFile.byteLength,
                    astSha256: sha256(parsedFile.json),
                });
                continue;
            }
            try {
                const normalized = JSON.parse(parsedFile.json) as NormalizedParserAst;
                const semantic = adaptNormalizedParserAst(normalized, transpileAuthority!.authority,
                    source.content, value => sha256(value));
                const emitted = emitSemanticProgram(semantic, {
                    compiler: ts49,
                    expectedTypeScriptVersion: transpileAuthority!.typeScriptVersion,
                });
                const collisionKey = portableCollisionKey(emitted.modulePath);
                if (outputKeys.has(collisionKey)) {
                    throw new CliError(`two sources emit the same portable module path: ${emitted.modulePath}`, 4);
                }
                outputKeys.add(collisionKey);
                const bytes = Buffer.byteLength(emitted.code, "utf8");
                totalOutputBytes += bytes;
                if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
                    throw new CliError("TypeScript output set exceeds --max-total-output-bytes", 5);
                }
                writeArtifact(publication, emitted.modulePath, emitted.code);
                transpiledFiles.push({
                    sourcePath: file.portablePath,
                    typescriptPath: emitted.modulePath,
                    sourceBytes: source.bytes.byteLength,
                    sourceSha256: sha256(source.bytes),
                    normalizedAstSha256: sha256(parsedFile.json),
                    normalizedFingerprintSha256: normalized.fingerprintSha256,
                    typescriptBytes: bytes,
                    typescriptSha256: sha256(emitted.code),
                });
            } catch (error) {
                if (error instanceof CliError) throw error;
                throw new CliError(`transpile rejected ${file.portablePath}: ${errorMessage(error)}`, 4);
            }
        }

        const manifest = options.operation === "parse" ? {
            schema: "bleach.as3.frontend-manifest.v1",
            toolVersion: TOOL_VERSION,
            upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
            astFormat: "legacy-as3-to-ts-node-v1",
            files: manifestFiles,
        } : {
            schema: "bleach.as3.transpile-manifest.v1",
            toolVersion: TOOL_VERSION,
            upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
            normalizedAstFormat: "authored-ui-as3-flat-ast@1",
            semanticFormat: "as3-semantic-ir@1",
            typeScriptVersion: transpileAuthority!.typeScriptVersion,
            sourceCapabilitySha256: transpileAuthority!.sourceCensusSha256,
            targetCapabilitySha256: transpileAuthority!.targetCapabilitiesSha256,
            capabilityMappingSha256: transpileAuthority!.capabilityMappingSha256,
            classification: "capability-authenticated-typescript-proposal",
            files: transpiledFiles,
        };
        const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
        totalOutputBytes += Buffer.byteLength(manifestJson, "utf8");
        if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
            throw new CliError("complete output exceeds --max-total-output-bytes", 5);
        }
        writeArtifact(publication, "manifest.json", manifestJson);
        publish(publication);
        const count = options.operation === "parse" ? manifestFiles.length : transpiledFiles.length;
        const verb = options.operation === "parse" ? "Parsed" : "Transpiled";
        io.stdout.write(`${verb} ${count} ActionScript file${count === 1 ? "" : "s"}.\n`);
        return 0;
    } catch (error) {
        abandon(publication);
        throw error;
    }
}

export async function run(
    argv: readonly string[] = process.argv.slice(2),
    io: Io = process,
): Promise<number> {
    try {
        return await execute(argv, io);
    } catch (error) {
        if (error instanceof CliError) {
            io.stderr.write(`as3-frontend: ${error.message}\n`);
            return error.exitCode;
        }
        io.stderr.write(`as3-frontend: internal error: ${errorMessage(error)}\n`);
        return 70;
    }
}

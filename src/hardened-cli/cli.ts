import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { CliError, errorMessage } from "./errors";
import { discoverInputs, readInput } from "./inputs";
import { parseIsolated } from "./isolated-parser";
import { HELP, parseArguments, TOOL_VERSION } from "./options";
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
    let publication: Publication | undefined;
    try {
        publication = preparePublication(options.outputDirectory, inputs.root);
        const manifestFiles: ManifestFile[] = [];
        let totalOutputBytes = 0;

        for (const file of inputs.files) {
            const source = readInput(file);
            const parsedFile = await parseIsolated(file.portablePath, source.content, options.limits);
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
        }

        const manifest = {
            schema: "bleach.as3.frontend-manifest.v1",
            toolVersion: TOOL_VERSION,
            upstreamParserRevision: "fa0b5151ab82758511ddd4b464f0c05b80e06da7",
            astFormat: "legacy-as3-to-ts-node-v1",
            files: manifestFiles,
        };
        const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
        totalOutputBytes += Buffer.byteLength(manifestJson, "utf8");
        if (totalOutputBytes > options.limits.maxTotalOutputBytes) {
            throw new CliError("complete output exceeds --max-total-output-bytes", 5);
        }
        writeArtifact(publication, "manifest.json", manifestJson);
        publish(publication);
        io.stdout.write(`Parsed ${manifestFiles.length} ActionScript file${manifestFiles.length === 1 ? "" : "s"}.\n`);
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

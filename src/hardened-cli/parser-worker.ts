import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import parse from "../parse/index";
import { normalizeParserAst, normalizeIncludedSource } from "../hardened/parser-normalizer";
import { createHash } from "node:crypto";
import { errorMessage } from "./errors";

interface ParserRequest {
    includeEdges?: import("../hardened/source-includes").IncludeEdge[];
    includeRootPath?: string;
    includeFragments?: import("../hardened/source-includes").IncludeSource[];
    sourcePath: string;
    content: string;
    maxAstBytes: number;
    format: "legacy" | "normalized";
    workerSha256: string;
}

interface ParserSuccess {
    ok: true;
    json: string;
    byteLength: number;
    workerSha256: string;
}

interface ParserFailure {
    ok: false;
    error: string;
    resourceLimit: boolean;
    workerSha256: string;
}

const MAX_DIAGNOSTIC_BYTES = 8 * 1024;
const WORKER_SHA256 = createHash("sha256").update(readFileSync(__filename)).digest("hex");

function isRequest(value: unknown): value is ParserRequest {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return typeof candidate.sourcePath === "string" &&
        typeof candidate.content === "string" &&
        Number.isSafeInteger(candidate.maxAstBytes) &&
        (candidate.maxAstBytes as number) > 0 &&
        (candidate.format === "legacy" || candidate.format === "normalized") &&
        typeof candidate.workerSha256 === "string" && /^[0-9a-f]{64}$/.test(candidate.workerSha256);
}

function boundedDiagnostic(error: unknown): string {
    const bytes = Buffer.from(errorMessage(error), "utf8");
    if (bytes.byteLength <= MAX_DIAGNOSTIC_BYTES) {
        return bytes.toString("utf8");
    }
    return `${bytes.subarray(0, MAX_DIAGNOSTIC_BYTES - 3).toString("utf8")}...`;
}

function reply(result: ParserSuccess | ParserFailure): void {
    if (!process.send) {
        process.exitCode = 70;
        return;
    }
    process.send(result, error => {
        process.exitCode = error ? 70 : 0;
        process.disconnect();
    });
}

process.once("message", (message: unknown) => {
    if (!isRequest(message)) {
        reply({ ok: false, error: "invalid parser request", resourceLimit: false, workerSha256: WORKER_SHA256 });
        return;
    }
    if (message.workerSha256 !== WORKER_SHA256) {
        reply({ ok: false, error: "parser worker authority mismatch", resourceLimit: false, workerSha256: WORKER_SHA256 });
        return;
    }
    try {
        const hash = (bytes:string):string => createHash("sha256").update(bytes, "utf8").digest("hex");
        const hasIncludes = message.includeFragments !== undefined;
        const ast = message.format === "normalized"
            ? hasIncludes ? normalizeIncludedSource(message.includeRootPath!, message.content, message.includeFragments!, hash, message.includeEdges)
                : normalizeParserAst(parse(message.sourcePath,message.content),message.content,hash)
            : parse(message.sourcePath,message.content);
        const json = `${JSON.stringify(ast, null, 2)}\n`;
        const byteLength = Buffer.byteLength(json, "utf8");
        if (byteLength > message.maxAstBytes) {
            reply({
                ok: false,
                error: `serialized AST exceeds --max-ast-bytes for ${message.sourcePath}`,
                resourceLimit: true,
                workerSha256: WORKER_SHA256,
            });
        } else {
            reply({ ok: true, json, byteLength, workerSha256: WORKER_SHA256 });
        }
    } catch (error) {
        reply({ ok: false, error: boundedDiagnostic(error), resourceLimit: false, workerSha256: WORKER_SHA256 });
    }
});

process.once("disconnect", () => {
    if (process.exitCode === undefined) {
        process.exitCode = 70;
    }
});

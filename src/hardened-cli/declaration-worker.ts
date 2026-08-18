import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import parse from "../parse/index";
import { normalizeParserAst } from "../hardened/parser-normalizer";
import { extractLocalDeclaration } from "../hardened/local-declarations";
import { errorMessage } from "./errors";

interface DeclarationRequest {
    sourcePath: string;
    content: string;
    maxResultBytes: number;
    workerSha256: string;
}

interface DeclarationSuccess {
    ok: true;
    json: string;
    byteLength: number;
    workerSha256: string;
}

interface DeclarationFailure {
    ok: false;
    error: string;
    resourceLimit: boolean;
    workerSha256: string;
}

const MAX_DIAGNOSTIC_BYTES = 8 * 1024;
const WORKER_SHA256 = createHash("sha256").update(readFileSync(__filename)).digest("hex");
const sha256 = (bytes: string): string => createHash("sha256").update(bytes, "utf8").digest("hex");

function isRequest(value: unknown): value is DeclarationRequest {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    const keys = Object.keys(candidate).sort();
    return keys.length === 4 && keys.join("|") === "content|maxResultBytes|sourcePath|workerSha256"
        && typeof candidate.sourcePath === "string" && candidate.sourcePath.length > 0
        && typeof candidate.content === "string"
        && Number.isSafeInteger(candidate.maxResultBytes) && (candidate.maxResultBytes as number) > 0
        && typeof candidate.workerSha256 === "string" && /^[0-9a-f]{64}$/.test(candidate.workerSha256);
}

function boundedDiagnostic(error: unknown): string {
    const bytes = Buffer.from(errorMessage(error), "utf8");
    return bytes.byteLength <= MAX_DIAGNOSTIC_BYTES ? bytes.toString("utf8")
        : `${bytes.subarray(0, MAX_DIAGNOSTIC_BYTES - 3).toString("utf8")}...`;
}

function reply(result: DeclarationSuccess | DeclarationFailure): void {
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
        reply({ ok: false, error: "invalid declaration request", resourceLimit: false, workerSha256: WORKER_SHA256 });
        return;
    }
    if (message.workerSha256 !== WORKER_SHA256) {
        reply({ ok: false, error: "declaration worker authority mismatch", resourceLimit: false, workerSha256: WORKER_SHA256 });
        return;
    }
    try {
        const parsed = parse(message.sourcePath, message.content);
        const normalized = normalizeParserAst(parsed, message.content, sha256);
        const result = extractLocalDeclaration(normalized, message.content, sha256);
        const json = `${JSON.stringify(result)}\n`;
        const byteLength = Buffer.byteLength(json, "utf8");
        if (byteLength > message.maxResultBytes) {
            reply({
                ok: false, error: `declaration result exceeds configured limit for ${message.sourcePath}`,
                resourceLimit: true, workerSha256: WORKER_SHA256,
            });
        } else {
            reply({ ok: true, json, byteLength, workerSha256: WORKER_SHA256 });
        }
    } catch (error) {
        reply({ ok: false, error: boundedDiagnostic(error), resourceLimit: false, workerSha256: WORKER_SHA256 });
    }
});

process.once("disconnect", () => {
    if (process.exitCode === undefined) process.exitCode = 70;
});

import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CliError, errorMessage } from "./errors";
import type { Limits } from "./options";

interface ParserRequest {
    compileDefinitions?: import("../hardened/compile-definitions").CompileDefinitions;
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

type ParserResult = ParserSuccess | ParserFailure;
const MAX_DIAGNOSTIC_BYTES = 8 * 1024;
const MAX_CHILD_STDERR_BYTES = 64 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;

function parserWorkerPath(): string {
    return join(__dirname, "parser-worker.js");
}

export function captureParserWorkerSha256(): string {
    return createHash("sha256").update(readFileSync(parserWorkerPath())).digest("hex");
}

export function assertParserWorkerSha256(expected: string): void {
    if (!SHA256.test(expected) || captureParserWorkerSha256() !== expected) {
        throw new CliError("parser worker authority changed during execution", 70);
    }
}

function parserEnvironment(): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const name of ["SystemRoot", "WINDIR", "TMP", "TEMP"]) {
        const value = process.env[name];
        if (value !== undefined) {
            environment[name] = value;
        }
    }
    return environment;
}

function isParserResult(value: unknown): value is ParserResult {
    if (!value || typeof value !== "object" || !("ok" in value)) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    if (candidate.ok === true) {
        return typeof candidate.json === "string" &&
            typeof candidate.byteLength === "number" && typeof candidate.workerSha256 === "string";
    }
    return candidate.ok === false &&
        typeof candidate.error === "string" &&
        Buffer.byteLength(candidate.error, "utf8") <= MAX_DIAGNOSTIC_BYTES &&
        typeof candidate.resourceLimit === "boolean" && typeof candidate.workerSha256 === "string";
}

export function parseIsolated(
    sourcePath: string,
    content: string,
    limits: Limits,
    format: "legacy" | "normalized" = "legacy",
    workerSha256: string = captureParserWorkerSha256(),
    includes?: {includeEdges:import("../hardened/source-includes").IncludeEdge[];includeRootPath:string;includeFragments:import("../hardened/source-includes").IncludeSource[]},
    compileDefinitions?: import("../hardened/compile-definitions").CompileDefinitions,
): Promise<ParserSuccess> {
    assertParserWorkerSha256(workerSha256);
    return new Promise((resolve, reject) => {
        const child = fork(parserWorkerPath(), [], {
            execPath: process.execPath,
            execArgv: [
                `--max-old-space-size=${limits.maxOldSpaceMb}`,
                `--max-semi-space-size=${Math.min(16, Math.max(1, Math.floor(limits.maxOldSpaceMb / 4)))}`,
                "--stack-size=4096",
                "--no-warnings",
            ],
            env: parserEnvironment(),
            serialization: "json",
            stdio: ["ignore", "ignore", "pipe", "ipc"],
        });
        let settled = false;
        let childStderrBytes = 0;

        const fail = (error: CliError): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            child.kill();
            reject(error);
        };

        const timer = setTimeout(() => {
            fail(new CliError(`parser timed out for ${sourcePath}`, 5));
        }, limits.timeoutMs);

        child.stderr?.on("data", (chunk: Buffer | string) => {
            childStderrBytes += Buffer.byteLength(chunk);
            if (childStderrBytes > MAX_CHILD_STDERR_BYTES) {
                fail(new CliError(`parser diagnostic limit exceeded for ${sourcePath}`, 5));
            }
        });
        child.once("message", (message: unknown) => {
            if (settled) {
                return;
            }
            if (!isParserResult(message)) {
                fail(new CliError(`invalid parser process response for ${sourcePath}`, 70));
            } else if (message.workerSha256 !== workerSha256) {
                fail(new CliError(`parser worker authority mismatch for ${sourcePath}`, 70));
            } else if (message.ok === false) {
                fail(new CliError(
                    `parse failed for ${sourcePath}: ${message.error}`,
                    message.resourceLimit ? 5 : 4,
                ));
            } else if (message.byteLength !== Buffer.byteLength(message.json, "utf8") ||
                    message.byteLength > limits.maxAstBytes) {
                fail(new CliError(`invalid parser process size for ${sourcePath}`, 70));
            } else {
                settled = true;
                clearTimeout(timer);
                child.disconnect();
                resolve(message);
            }
        });
        child.once("error", (error: unknown) => {
            fail(new CliError(`cannot start parser process for ${sourcePath}: ${errorMessage(error)}`, 70));
        });
        child.once("exit", (code, signal) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            if (code !== 0 || signal !== null) {
                reject(new CliError(`parser process hit a resource limit for ${sourcePath}`, 5));
            } else {
                reject(new CliError(`parser process exited before replying for ${sourcePath}`, 70));
            }
        });

        const request: ParserRequest = {
            ...includes, ...(compileDefinitions ? {compileDefinitions} : {}), sourcePath, content, maxAstBytes: limits.maxAstBytes, format, workerSha256 };
        child.send(request, error => {
            if (error) {
                fail(new CliError(`cannot send source to parser process: ${errorMessage(error)}`, 70));
            }
        });
    });
}

import { Buffer } from "node:buffer";
import parse from "../parse/index";
import { errorMessage } from "./errors";

interface ParserRequest {
    sourcePath: string;
    content: string;
    maxAstBytes: number;
}

interface ParserSuccess {
    ok: true;
    json: string;
    byteLength: number;
}

interface ParserFailure {
    ok: false;
    error: string;
    resourceLimit: boolean;
}

const MAX_DIAGNOSTIC_BYTES = 8 * 1024;

function isRequest(value: unknown): value is ParserRequest {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return typeof candidate.sourcePath === "string" &&
        typeof candidate.content === "string" &&
        Number.isSafeInteger(candidate.maxAstBytes) &&
        (candidate.maxAstBytes as number) > 0;
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
        reply({ ok: false, error: "invalid parser request", resourceLimit: false });
        return;
    }
    try {
        const ast = parse(message.sourcePath, message.content);
        const json = `${JSON.stringify(ast, null, 2)}\n`;
        const byteLength = Buffer.byteLength(json, "utf8");
        if (byteLength > message.maxAstBytes) {
            reply({
                ok: false,
                error: `serialized AST exceeds --max-ast-bytes for ${message.sourcePath}`,
                resourceLimit: true,
            });
        } else {
            reply({ ok: true, json, byteLength });
        }
    } catch (error) {
        reply({ ok: false, error: boundedDiagnostic(error), resourceLimit: false });
    }
});

process.once("disconnect", () => {
    if (process.exitCode === undefined) {
        process.exitCode = 70;
    }
});

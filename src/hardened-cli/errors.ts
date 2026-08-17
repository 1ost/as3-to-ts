export type CliExitCode = 2 | 3 | 4 | 5 | 6 | 70;

export class CliError extends Error {
    constructor(
        message: string,
        readonly exitCode: CliExitCode,
    ) {
        super(message);
        this.name = "CliError";
    }
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

import { CliError } from "./errors";

export const TOOL_VERSION = "0.1.0";

export interface Limits {
    timeoutMs: number;
    maxFiles: number;
    maxEntries: number;
    maxDirectories: number;
    maxDepth: number;
    maxPathBytes: number;
    maxFileBytes: number;
    maxTotalBytes: number;
    maxAstBytes: number;
    maxTotalOutputBytes: number;
    maxOldSpaceMb: number;
}

interface BaseRunOptions {
    sourceDirectory: string;
    outputDirectory: string;
    limits: Limits;
}

export interface ParseRunOptions extends BaseRunOptions {
    operation: "parse";
}

export interface CapabilityRunOptions extends BaseRunOptions {
    operation: "transpile" | "qualify";
    sourceCensusPath: string;
    targetCapabilitiesPath: string;
    profileLockPath?: string;
    sourceClosurePath?: string;
    sourcePlanPath?: string;
    secondaryAuthorityPath?: string;
    compilerProviderPath?: string;
}

export type RunOptions = ParseRunOptions | CapabilityRunOptions;

export type ParsedArguments =
    | { mode: "help" }
    | { mode: "version" }
    | { mode: "run"; options: RunOptions };

const defaults: Limits = {
    timeoutMs: 2_000,
    maxFiles: 10_000,
    maxEntries: 100_000,
    maxDirectories: 25_000,
    maxDepth: 64,
    maxPathBytes: 4_096,
    maxFileBytes: 2 * 1024 * 1024,
    maxTotalBytes: 128 * 1024 * 1024,
    maxAstBytes: 16 * 1024 * 1024,
    maxTotalOutputBytes: 256 * 1024 * 1024,
    maxOldSpaceMb: 64,
};

const ceilings: Limits = {
    timeoutMs: 60_000,
    maxFiles: 100_000,
    maxEntries: 1_000_000,
    maxDirectories: 250_000,
    maxDepth: 256,
    maxPathBytes: 32_768,
    maxFileBytes: 16 * 1024 * 1024,
    maxTotalBytes: 1024 * 1024 * 1024,
    maxAstBytes: 64 * 1024 * 1024,
    maxTotalOutputBytes: 2 * 1024 * 1024 * 1024,
    maxOldSpaceMb: 512,
};

const numericOptions: Readonly<Record<string, keyof Limits>> = {
    "--timeout-ms": "timeoutMs",
    "--max-files": "maxFiles",
    "--max-entries": "maxEntries",
    "--max-directories": "maxDirectories",
    "--max-depth": "maxDepth",
    "--max-path-bytes": "maxPathBytes",
    "--max-file-bytes": "maxFileBytes",
    "--max-total-bytes": "maxTotalBytes",
    "--max-ast-bytes": "maxAstBytes",
    "--max-total-output-bytes": "maxTotalOutputBytes",
    "--max-old-space-mb": "maxOldSpaceMb",
};

const authorityOptions = new Set(["--source-census", "--target-capabilities", "--profile-lock", "--source-closure", "--source-plan", "--secondary-authority", "--compiler-provider"]);

function parsePositiveInteger(option: string, value: string, ceiling: number): number {
    if (!/^[1-9][0-9]*$/.test(value)) {
        throw new CliError(`${option} requires a positive base-10 integer`, 2);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > ceiling) {
        throw new CliError(`${option} exceeds its hard ceiling of ${ceiling}`, 2);
    }
    return parsed;
}

export function parseArguments(argv: readonly string[]): ParsedArguments {
    if (argv.length === 1 && argv[0] === "--help") {
        return { mode: "help" };
    }
    if (argv.length === 1 && argv[0] === "--version") {
        return { mode: "version" };
    }

    const positional: string[] = [];
    const authorities: Record<string, string> = Object.create(null) as Record<string, string>;
    const limits: Limits = { ...defaults };
    const seen = new Set<string>();

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index]!;
        if (!argument.startsWith("-")) {
            positional.push(argument);
            continue;
        }
        if (!argument.startsWith("--")) {
            throw new CliError(`unknown option: ${argument}`, 2);
        }

        const equals = argument.indexOf("=");
        const option = equals === -1 ? argument : argument.slice(0, equals);
        const key = numericOptions[option];
        if (key === undefined && !authorityOptions.has(option)) {
            throw new CliError(`unknown option: ${option}`, 2);
        }
        if (seen.has(option)) {
            throw new CliError(`duplicate option: ${option}`, 2);
        }
        seen.add(option);

        let value: string;
        if (equals !== -1) {
            value = argument.slice(equals + 1);
        } else {
            index++;
            const following = argv[index];
            if (following === undefined || following.startsWith("--")) {
                throw new CliError(`${option} requires a value`, 2);
            }
            value = following;
        }
        if (key !== undefined) {
            limits[key] = parsePositiveInteger(option, value, ceilings[key]);
        } else {
            if (value.length === 0) throw new CliError(`${option} requires a nonempty path`, 2);
            authorities[option] = value;
        }
    }

    let operation: "parse" | "transpile" | "qualify" = "parse";
    if (positional[0] === "parse" || positional[0] === "transpile" || positional[0] === "qualify") {
        operation = positional.shift() as "parse" | "transpile" | "qualify";
    }
    if (positional.length !== 2) {
        throw new CliError("an operation, one source directory, and one output directory are required", 2);
    }
    if (operation === "parse") {
        if (Object.keys(authorities).length !== 0) {
            throw new CliError("capability authority options are valid only for transpile", 2);
        }
        return {
            mode: "run",
            options: {
                operation,
                sourceDirectory: positional[0]!,
                outputDirectory: positional[1]!,
                limits,
            },
        };
    }
    const sourceCensusPath = authorities["--source-census"];
    const targetCapabilitiesPath = authorities["--target-capabilities"];
    const profileLockPath = authorities["--profile-lock"];
    const sourceClosurePath = authorities["--source-closure"];
    const sourcePlanPath = authorities["--source-plan"];
    const secondaryAuthorityPath = authorities["--secondary-authority"];
    const compilerProviderPath=authorities["--compiler-provider"];
    if (sourceCensusPath === undefined || targetCapabilitiesPath === undefined) {
        throw new CliError("transpile requires --source-census and --target-capabilities", 2);
    }
    if ((sourceClosurePath !== undefined || sourcePlanPath !== undefined) && profileLockPath === undefined) {
        throw new CliError("--source-closure and --source-plan require --profile-lock", 2);
    }
    if (sourceClosurePath !== undefined && sourcePlanPath !== undefined) {
        throw new CliError("--source-closure and --source-plan are mutually exclusive", 2);
    }
    if (sourcePlanPath !== undefined && operation !== "qualify") {
        throw new CliError("--source-plan is valid only for qualify", 2);
    }
    if (secondaryAuthorityPath !== undefined && (operation !== "transpile" || sourceClosurePath === undefined)) {
        throw new CliError("--secondary-authority requires transpile with --source-closure", 2);
    }
    if((secondaryAuthorityPath===undefined)!==(compilerProviderPath===undefined))
        throw new CliError("--secondary-authority and --compiler-provider are required together",2);
    return {
        mode: "run",
        options: {
            operation,
            sourceDirectory: positional[0]!,
            outputDirectory: positional[1]!,
            limits,
            sourceCensusPath,
            targetCapabilitiesPath,
            ...(profileLockPath === undefined ? {} : { profileLockPath }),
            ...(sourceClosurePath === undefined ? {} : { sourceClosurePath }),
            ...(sourcePlanPath === undefined ? {} : { sourcePlanPath }),
            ...(secondaryAuthorityPath === undefined ? {} : { secondaryAuthorityPath }),
            ...(compilerProviderPath===undefined?{}:{compilerProviderPath}),
        },
    };
}

export const HELP = `Usage:
  as3-frontend parse <source-directory> <output-directory> [options]
  as3-frontend transpile <source-directory> <output-directory> --source-census <file> --target-capabilities <file> [--profile-lock <file>] [--source-closure <file>] [--secondary-authority <file> --compiler-provider <file>] [options]
  as3-frontend qualify <source-directory> <output-directory> --source-census <file> --target-capabilities <file> [--profile-lock <file>] [--source-closure <file> | --source-plan <file>] [options]

Parse emits deterministic legacy-AST JSON artifacts. Transpile emits only the
closed, capability-authenticated TypeScript subset. Qualify emits a report of
admitted and held sources without materializing TypeScript. The two-argument
legacy form remains an alias for parse.
The output directory must not already exist.

Options:
  --timeout-ms <n>              Per-file parser wall timeout (default 2000)
  --max-files <n>               Input file count cap (default 10000)
  --max-entries <n>             All source-tree entries cap (default 100000)
  --max-directories <n>         Source directory cap (default 25000)
  --max-depth <n>               Source path depth cap (default 64)
  --max-path-bytes <n>          Portable source path byte cap (default 4096)
  --max-file-bytes <n>          Per-file raw byte cap (default 2097152)
  --max-total-bytes <n>         Total raw input byte cap (default 134217728)
  --max-ast-bytes <n>           Per-file serialized AST cap (default 16777216)
  --max-total-output-bytes <n>  Total serialized AST cap (default 268435456)
  --max-old-space-mb <n>        Parser worker old-generation cap (default 64)
  --source-census <file>        Exact application AS3 capability census (transpile)
  --target-capabilities <file>  Exact Laya authored capability ledger (transpile)
  --profile-lock <file>         Optional exact application profile; omitted preserves Bleach defaults
  --source-closure <file>       Exact profile-bound application/bootstrap source allow-list
  --source-plan <file>          Qualify an authenticated dependency superset and derive its exact closure
  --secondary-authority <file>  Authenticated inert-v1 or browser-linker-v2 request
  --compiler-provider <file>    Exact executing compiler provenance authority
  --help                        Show this help
  --version                     Show the local tool version
`;

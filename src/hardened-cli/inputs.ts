import {
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    openSync,
    opendirSync,
    readSync,
    realpathSync,
} from "node:fs";
import { isAbsolute, join, parse as parsePath, relative, resolve, sep } from "node:path";
import { TextDecoder } from "node:util";
import { CliError } from "./errors";
import type { Limits } from "./options";

interface PhysicalIdentity {
    dev: bigint;
    ino: bigint;
    size: bigint;
    mtimeNs: bigint;
}

export interface InputFile {
    absolutePath: string;
    portablePath: string;
    identity: PhysicalIdentity;
    byteLength: number;
}

export interface DiscoveredInputs {
    root: string;
    files: InputFile[];
}

function compareUtf8(left: string, right: string): number {
    return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function portableCollisionKey(path: string): string {
    let folded = path.normalize("NFC");
    for (let pass = 0; pass < 8; pass++) {
        const next = folded.toUpperCase().toLowerCase().normalize("NFC");
        if (next === folded) {
            return next;
        }
        folded = next;
    }
    return folded;
}

const windowsDeviceName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function validatePortableName(name: string, portablePath: string): void {
    if (name !== name.normalize("NFC")) {
        throw new CliError(`non-NFC path is not portable: ${portablePath}`, 3);
    }
    if (/[\u0000-\u001f\u007f\\:]/.test(name) || /[. ]$/.test(name) || windowsDeviceName.test(name)) {
        throw new CliError(`source path is not portable: ${portablePath}`, 3);
    }
    for (const character of name) {
        if (character.codePointAt(0)! > 0x7f && character.toLowerCase() !== character.toUpperCase()) {
            throw new CliError(`non-ASCII cased source path is not portable: ${portablePath}`, 3);
        }
    }
}

function isWithin(root: string, candidate: string): boolean {
    const fromRoot = relative(root, candidate);
    return fromRoot === "" || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`));
}

export function assertNoSymlinkComponents(path: string, label: string): void {
    const absolute = resolve(path);
    const root = parsePath(absolute).root;
    let current = root;
    const components = relative(root, absolute).split(sep).filter(component => component !== "");
    for (const component of components) {
        current = join(current, component);
        let stat: ReturnType<typeof lstatSync>;
        try {
            stat = lstatSync(current);
        } catch {
            throw new CliError(`${label} does not exist`, 3);
        }
        if (stat.isSymbolicLink()) {
            throw new CliError(`${label} contains a symlink or junction component`, 3);
        }
    }
}

function toIdentity(stat: ReturnType<typeof lstatSync>): PhysicalIdentity {
    const bigintStat = stat as unknown as {
        dev: bigint;
        ino: bigint;
        size: bigint;
        mtimeNs: bigint;
    };
    return {
        dev: bigintStat.dev,
        ino: bigintStat.ino,
        size: bigintStat.size,
        mtimeNs: bigintStat.mtimeNs,
    };
}

function sameIdentity(left: PhysicalIdentity, right: PhysicalIdentity): boolean {
    return left.dev === right.dev &&
        left.ino === right.ino &&
        left.size === right.size &&
        left.mtimeNs === right.mtimeNs;
}

export function discoverInputs(sourceArgument: string, limits: Limits): DiscoveredInputs {
    const lexicalRoot = resolve(sourceArgument);
    assertNoSymlinkComponents(lexicalRoot, "source directory");
    let rootStat: ReturnType<typeof lstatSync> | undefined;
    try {
        rootStat = lstatSync(lexicalRoot, { bigint: true }) as unknown as ReturnType<typeof lstatSync>;
    } catch {
        throw new CliError("source directory does not exist", 3);
    }
    if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
        throw new CliError("source root must be a real directory, not a symlink or junction", 3);
    }
    const root = realpathSync.native(lexicalRoot);
    const files: InputFile[] = [];
    const identities = new Map<string, string>();
    let totalBytes = 0;
    let entryCount = 0;
    let directoryCount = 1;
    const pending: Array<{ directory: string; segments: string[] }> = [{ directory: root, segments: [] }];

    while (pending.length > 0) {
        const { directory, segments } = pending.pop()!;
        const entries: import("node:fs").Dirent[] = [];
        const directoryHandle = opendirSync(directory);
        try {
            for (;;) {
                const entry = directoryHandle.readSync();
                if (entry === null) {
                    break;
                }
                entryCount++;
                if (entryCount > limits.maxEntries) {
                    throw new CliError("source tree exceeds --max-entries", 5);
                }
                entries.push(entry);
            }
        } finally {
            directoryHandle.closeSync();
        }
        const names = new Map<string, string>();
        for (const entry of entries) {
            validatePortableName(entry.name, [...segments, entry.name].join("/"));
            const key = portableCollisionKey(entry.name);
            const previous = names.get(key);
            if (previous !== undefined && previous !== entry.name) {
                throw new CliError(`case/NFC path collision: ${previous} and ${entry.name}`, 3);
            }
            names.set(key, entry.name);
        }
        entries.sort((left, right) => compareUtf8(left.name, right.name));
        const childDirectories: Array<{ directory: string; segments: string[] }> = [];
        for (const entry of entries) {
            const childSegments = [...segments, entry.name];
            const portablePath = childSegments.join("/");
            if (childSegments.length > limits.maxDepth) {
                throw new CliError(`source path exceeds --max-depth: ${portablePath}`, 5);
            }
            if (Buffer.byteLength(portablePath, "utf8") > limits.maxPathBytes) {
                throw new CliError(`source path exceeds --max-path-bytes: ${portablePath}`, 5);
            }
            const absolutePath = resolve(directory, entry.name);
            const stat = lstatSync(absolutePath, { bigint: true });
            if (stat.isSymbolicLink()) {
                throw new CliError(`symlink or junction is forbidden in source tree: ${portablePath}`, 3);
            }
            const canonical = realpathSync.native(absolutePath);
            if (!isWithin(root, canonical)) {
                throw new CliError(`source path escapes its root: ${portablePath}`, 3);
            }
            if (stat.isDirectory()) {
                directoryCount++;
                if (directoryCount > limits.maxDirectories) {
                    throw new CliError("source tree exceeds --max-directories", 5);
                }
                childDirectories.push({ directory: canonical, segments: childSegments });
            } else if (stat.isFile()) {
                if (!/\.as$/i.test(entry.name)) {
                    continue;
                }
                const byteLength = Number(stat.size);
                if (!Number.isSafeInteger(byteLength) || byteLength > limits.maxFileBytes) {
                    throw new CliError(`source exceeds --max-file-bytes: ${portablePath}`, 5);
                }
                totalBytes += byteLength;
                if (totalBytes > limits.maxTotalBytes) {
                    throw new CliError("source set exceeds --max-total-bytes", 5);
                }
                const identity = toIdentity(stat as unknown as ReturnType<typeof lstatSync>);
                const identityKey = `${identity.dev}:${identity.ino}`;
                const duplicate = identities.get(identityKey);
                if (duplicate !== undefined) {
                    throw new CliError(`hard-linked source aliases are forbidden: ${duplicate} and ${portablePath}`, 3);
                }
                identities.set(identityKey, portablePath);
                files.push({
                    absolutePath: canonical,
                    portablePath,
                    identity,
                    byteLength,
                });
                if (files.length > limits.maxFiles) {
                    throw new CliError("source set exceeds --max-files", 5);
                }
            } else {
                throw new CliError(`non-regular source entry is forbidden: ${portablePath}`, 3);
            }
        }
        for (let index = childDirectories.length - 1; index >= 0; index--) {
            pending.push(childDirectories[index]!);
        }
    }
    if (files.length === 0) {
        throw new CliError("source tree contains no ActionScript files", 3);
    }
    files.sort((left, right) => compareUtf8(left.portablePath, right.portablePath));
    return { root, files };
}

export interface ReadInput {
    bytes: Buffer;
    content: string;
}

export function readInput(file: InputFile): ReadInput {
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    let descriptor: number;
    try {
        descriptor = openSync(file.absolutePath, constants.O_RDONLY | noFollow);
    } catch {
        throw new CliError(`cannot safely open source: ${file.portablePath}`, 3);
    }
    try {
        const before = toIdentity(fstatSync(descriptor, { bigint: true }) as unknown as ReturnType<typeof lstatSync>);
        if (!sameIdentity(file.identity, before)) {
            throw new CliError(`source changed after discovery: ${file.portablePath}`, 3);
        }
        const bytes = Buffer.allocUnsafe(file.byteLength + 1);
        let bytesRead = 0;
        while (bytesRead < bytes.byteLength) {
            const count = readSync(descriptor, bytes, bytesRead, bytes.byteLength - bytesRead, null);
            if (count === 0) {
                break;
            }
            bytesRead += count;
        }
        const after = toIdentity(fstatSync(descriptor, { bigint: true }) as unknown as ReturnType<typeof lstatSync>);
        if (!sameIdentity(before, after) || bytesRead !== file.byteLength) {
            throw new CliError(`source changed while reading: ${file.portablePath}`, 3);
        }
        const exactBytes = bytes.subarray(0, bytesRead);
        let content: string;
        try {
            content = new TextDecoder("utf-8", { fatal: true }).decode(exactBytes);
        } catch {
            throw new CliError(`source is not valid UTF-8: ${file.portablePath}`, 3);
        }
        if (content.includes("\0")) {
            throw new CliError(`source contains a NUL character: ${file.portablePath}`, 3);
        }
        return { bytes: exactBytes, content };
    } finally {
        closeSync(descriptor);
    }
}

export function pathsOverlap(left: string, right: string): boolean {
    return isWithin(left, right) || isWithin(right, left);
}

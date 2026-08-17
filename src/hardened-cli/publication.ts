import { createHash, randomBytes } from "node:crypto";
import {
    closeSync,
    constants,
    existsSync,
    fstatSync,
    fsyncSync,
    lstatSync,
    mkdirSync,
    openSync,
    readSync,
    realpathSync,
    readdirSync,
    renameSync,
    rmSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { CliError } from "./errors";
import { assertNoSymlinkComponents, pathsOverlap, portableCollisionKey } from "./inputs";

interface ArtifactExpectation {
    byteLength: number;
    sha256: string;
}

export interface Publication {
    output: string;
    outputName: string;
    parent: string;
    parentIdentity: string;
    staging: string;
    stagingIdentity: string;
    lockPath: string;
    lockIdentity: string;
    lockDescriptor: number | undefined;
    artifacts: Map<string, ArtifactExpectation>;
}

function identity(path: string): string {
    const stat = lstatSync(path, { bigint: true });
    return `${stat.dev}:${stat.ino}`;
}

function descriptorIdentity(descriptor: number): string {
    const stat = fstatSync(descriptor, { bigint: true });
    return `${stat.dev}:${stat.ino}`;
}

function sha256(content: string | Buffer): string {
    return createHash("sha256").update(content).digest("hex");
}

function assertNoOutputCollision(publication: Publication): void {
    const ignored = new Set([basename(publication.lockPath), basename(publication.staging)]);
    const collisionKey = portableCollisionKey(publication.outputName);
    for (const sibling of readdirSync(publication.parent)) {
        if (!ignored.has(sibling) && portableCollisionKey(sibling) === collisionKey) {
            throw new CliError(`output path collides by case or NFC with existing entry: ${sibling}`, 6);
        }
    }
}

function readBounded(path: string, expectedBytes: number): Buffer {
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    const descriptor = openSync(path, constants.O_RDONLY | noFollow);
    try {
        const before = fstatSync(descriptor, { bigint: true });
        if (!before.isFile() || before.size !== BigInt(expectedBytes)) {
            throw new CliError("staged artifact changed before publication", 6);
        }
        const buffer = Buffer.allocUnsafe(expectedBytes + 1);
        let offset = 0;
        while (offset < buffer.byteLength) {
            const count = readSync(descriptor, buffer, offset, buffer.byteLength - offset, null);
            if (count === 0) {
                break;
            }
            offset += count;
        }
        const after = fstatSync(descriptor, { bigint: true });
        if (offset !== expectedBytes || before.dev !== after.dev || before.ino !== after.ino ||
                before.size !== after.size || before.mtimeNs !== after.mtimeNs) {
            throw new CliError("staged artifact changed during publication", 6);
        }
        return buffer.subarray(0, offset);
    } finally {
        closeSync(descriptor);
    }
}

function validateArtifacts(publication: Publication): void {
    const actualFiles = new Set<string>();
    const pending = [publication.staging];
    while (pending.length > 0) {
        const directory = pending.pop()!;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const absolute = join(directory, entry.name);
            const stat = lstatSync(absolute);
            if (stat.isSymbolicLink()) {
                throw new CliError("staged output contains a symlink or junction", 6);
            }
            if (stat.isDirectory()) {
                pending.push(absolute);
            } else if (stat.isFile()) {
                actualFiles.add(absolute);
            } else {
                throw new CliError("staged output contains a non-regular entry", 6);
            }
        }
    }
    if (actualFiles.size !== publication.artifacts.size) {
        throw new CliError("staged output file set changed before publication", 6);
    }
    for (const [absolute, expected] of publication.artifacts) {
        if (!actualFiles.has(absolute)) {
            throw new CliError("staged output file set changed before publication", 6);
        }
        const bytes = readBounded(absolute, expected.byteLength);
        if (sha256(bytes) !== expected.sha256) {
            throw new CliError("staged artifact hash changed before publication", 6);
        }
    }
}

function releaseLock(publication: Publication): void {
    if (publication.lockDescriptor !== undefined) {
        closeSync(publication.lockDescriptor);
        publication.lockDescriptor = undefined;
    }
    if (existsSync(publication.lockPath)) {
        unlinkSync(publication.lockPath);
    }
}

export function preparePublication(outputArgument: string, sourceRoot: string): Publication {
    const lexicalOutput = resolve(outputArgument);
    if (existsSync(lexicalOutput)) {
        throw new CliError("output directory already exists", 3);
    }
    const lexicalParent = dirname(lexicalOutput);
    assertNoSymlinkComponents(lexicalParent, "output parent directory");
    let parentStat: ReturnType<typeof lstatSync>;
    try {
        parentStat = lstatSync(lexicalParent);
    } catch {
        throw new CliError("output parent directory does not exist", 3);
    }
    if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
        throw new CliError("output parent must be a real directory, not a symlink or junction", 3);
    }
    const parent = realpathSync.native(lexicalParent);
    const outputName = basename(lexicalOutput);
    if (outputName !== outputName.normalize("NFC")) {
        throw new CliError("output directory name must be NFC-normalized", 3);
    }
    if (/[\u0000-\u001f\u007f\\:]/.test(outputName) || /[. ]$/.test(outputName) ||
            /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(outputName)) {
        throw new CliError("output directory name is not portable", 3);
    }
    for (const character of outputName) {
        if (character.codePointAt(0)! > 0x7f && character.toLowerCase() !== character.toUpperCase()) {
            throw new CliError("output directory contains non-ASCII cased characters", 3);
        }
    }
    const output = join(parent, outputName);
    if (pathsOverlap(sourceRoot, output)) {
        throw new CliError("source and output directories must not overlap", 3);
    }
    const staging = join(parent, `.${outputName}.staging-${process.pid}-${randomBytes(12).toString("hex")}`);
    const reservationKey = sha256(portableCollisionKey(outputName));
    const lockPath = join(parent, `.as3-frontend-publish-${reservationKey}.lock`);
    let lockDescriptor: number | undefined;
    try {
        lockDescriptor = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
        writeFileSync(lockDescriptor, `${process.pid}\n`, "utf8");
        fsyncSync(lockDescriptor);
        mkdirSync(staging, { mode: 0o700 });
        const publication: Publication = {
            output,
            outputName,
            parent,
            parentIdentity: identity(parent),
            staging,
            stagingIdentity: identity(staging),
            lockPath,
            lockIdentity: descriptorIdentity(lockDescriptor),
            lockDescriptor,
            artifacts: new Map(),
        };
        assertNoOutputCollision(publication);
        return publication;
    } catch (error) {
        if (existsSync(staging)) {
            rmSync(staging, { recursive: true, force: true });
        }
        if (lockDescriptor !== undefined) {
            closeSync(lockDescriptor);
            if (existsSync(lockPath)) {
                unlinkSync(lockPath);
            }
        }
        if (error instanceof CliError) {
            throw error;
        }
        throw new CliError("cannot reserve output publication", 6);
    }
}

export function writeArtifact(publication: Publication, portablePath: string, content: string): void {
    const segments = portablePath.split("/");
    if (segments.some(segment => segment === "" || segment === "." || segment === "..")) {
        throw new CliError("internal artifact path invariant failed", 70);
    }
    const destination = join(publication.staging, ...segments);
    if (!destination.startsWith(`${publication.staging}${sep}`)) {
        throw new CliError("internal artifact path escaped staging", 70);
    }
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    const descriptor = openSync(destination, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try {
        writeFileSync(descriptor, content, "utf8");
        fsyncSync(descriptor);
    } finally {
        closeSync(descriptor);
    }
    publication.artifacts.set(destination, {
        byteLength: Buffer.byteLength(content, "utf8"),
        sha256: sha256(content),
    });
}

export function publish(publication: Publication): void {
    if (realpathSync.native(publication.parent) !== publication.parent ||
            identity(publication.parent) !== publication.parentIdentity) {
        throw new CliError("output parent changed during generation", 6);
    }
    if (!existsSync(publication.staging)) {
        throw new CliError("staged output root changed during generation", 6);
    }
    const stagingStat = lstatSync(publication.staging);
    if (stagingStat.isSymbolicLink() || !stagingStat.isDirectory() ||
            identity(publication.staging) !== publication.stagingIdentity) {
        throw new CliError("staged output root changed during generation", 6);
    }
    if (publication.lockDescriptor === undefined || !existsSync(publication.lockPath) ||
            identity(publication.lockPath) !== publication.lockIdentity ||
            descriptorIdentity(publication.lockDescriptor) !== publication.lockIdentity) {
        throw new CliError("output publication reservation changed during generation", 6);
    }
    assertNoOutputCollision(publication);
    validateArtifacts(publication);
    assertNoOutputCollision(publication);
    try {
        renameSync(publication.staging, publication.output);
    } catch {
        throw new CliError("failed to atomically publish staged output", 6);
    }
    try {
        releaseLock(publication);
    } catch {
        // The complete output is already atomically visible; a stale reservation
        // is safer than reporting the successful publication as a failed one.
    }
}

export function abandon(publication: Publication | undefined): void {
    if (!publication) {
        return;
    }
    if (existsSync(publication.staging)) {
        rmSync(publication.staging, { recursive: true, force: true });
    }
    try {
        releaseLock(publication);
    } catch {
        // Preserve the original failure. A stale lock fails closed on the next run.
    }
}

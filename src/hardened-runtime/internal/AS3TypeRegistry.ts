export interface AS3TypeToken<T> {
    readonly name: string;
}

export type AS3ClassValue = Function | AS3TypeToken<unknown>;
export type RuntimeConstructor<T extends object = object> = abstract new (...args: any[]) => T;
type AS3RuntimeTypeKind = "primitive" | "class" | "interface" | "vector";

interface TypeDetails<T> {
    readonly kind: AS3RuntimeTypeKind;
    readonly test: (value: unknown) => value is T;
    readonly referenceClosure?: readonly object[];
}

export interface AS3InterfaceAuthorityEntry {
    readonly kind: "interface";
    readonly qname: string;
    readonly bases: readonly string[];
}

export interface AS3ObjectTraits {
    readonly dynamic: boolean;
    readonly members: readonly { readonly name: string;
        readonly kind: "field" | "const" | "method" | "getter" | "setter"; readonly type: string;
        readonly visibility: "public" | "private" | "protected" | "internal" | "namespace"; readonly namespaceName:string | null }[];
}

export interface AS3NativeObjectTraits {
    readonly dynamic: boolean | null;
    readonly names: readonly string[];
    readonly sourceArtifactSha256: string;
}

export interface AS3ClassAuthorityEntry {
    readonly kind: "class";
    readonly qname: string;
    readonly base: string | null;
    readonly interfaces: readonly string[];
    readonly sourceSha256: string;
    readonly objectTraits?: AS3ObjectTraits;
    readonly nativeObjectTraits?: AS3NativeObjectTraits;
    readonly fields: readonly { readonly name: string; readonly policy: "zero" | "nan" | "false" | "null" | "undefined" }[];
    readonly constructor: RuntimeConstructor;
    readonly predicate: (value: unknown) => boolean;
    readonly constructionTarget: ((value: unknown) => RuntimeConstructor | null) | null;
    readonly constructionProof: ((value: unknown) => boolean) | null;
}

export type AS3AuthorityEntry = AS3InterfaceAuthorityEntry | AS3ClassAuthorityEntry;

export interface AS3TypeAuthorityDocument {
    readonly schema: "as3-runtime-type-authority@1";
    readonly sha256: string;
    readonly qnames: readonly string[];
    readonly entries: readonly AS3AuthorityEntry[];
}

const TYPE_TOKENS = new WeakSet<object>();
const TYPE_DETAILS = new WeakMap<object, TypeDetails<unknown>>();
const CLASS_TOKENS = new WeakMap<Function, AS3TypeToken<object>>();
const CLASS_BY_QNAME = new Map<string, { readonly constructor: RuntimeConstructor; readonly token: AS3TypeToken<object> }>();
const CLASS_INTERFACES = new WeakMap<Function, readonly object[]>();
const CLASS_PREDICATES = new WeakMap<Function, (value: unknown) => boolean>();
const CLASS_CONSTRUCTION_TARGETS = new WeakMap<Function, (value: unknown) => RuntimeConstructor | null>();
const CLASS_CONSTRUCTION_PROOFS = new WeakMap<Function, (value: unknown) => boolean>();
const CLASS_FIELD_DEFAULTS = new WeakMap<Function, AS3ClassAuthorityEntry["fields"]>();
const CLASS_OBJECT_ENTRIES = new WeakMap<Function, Readonly<{qname:string; traits:AS3ObjectTraits | null; nativeTraits:AS3NativeObjectTraits | null}>>();
const CLASS_BASES = new WeakMap<Function, RuntimeConstructor | null>();
const REGISTERED_CLASSES: Function[] = [];
const INTERFACE_TOKENS = new Map<string, AS3TypeToken<object>>();
const VECTOR_TYPE_TOKENS = new WeakMap<object, AS3TypeToken<object>>();
const VECTOR_TYPE_NAMES = new WeakMap<object, string>();
const VECTOR_TYPE_PREDICATES = new WeakMap<object, (value: unknown) => boolean>();
let authorityState: "open" | "installing" | "sealed" = "open";
let installedAuthoritySha256: string | null = null;
const INITIALIZED_INSTANCE_FIELDS = new WeakSet<object>();
const ACTIVE_CONSTRUCTIONS = new WeakMap<object, RuntimeConstructor>();
interface PreparedConstructionFrame {
    readonly target: RuntimeConstructor;
    state: "prepared" | "consumed" | "cancelled";
    [Symbol.iterator](): Iterator<never>;
}
const PREPARED_CONSTRUCTION_FRAMES: PreparedConstructionFrame[] = [];
const AUTHENTIC_CONSTRUCTION_FRAMES = new WeakSet<object>();

function constructionFrame(target: RuntimeConstructor): PreparedConstructionFrame {
    const frame: PreparedConstructionFrame = {
        target,
        state: "prepared",
        [Symbol.iterator](): Iterator<never> {
            return { next(): IteratorResult<never> { return { done: true, value: undefined as never }; } };
        },
    };
    AUTHENTIC_CONSTRUCTION_FRAMES.add(frame);
    return frame;
}

function pendingConstructionTarget(value: unknown): RuntimeConstructor | null {
    let result: RuntimeConstructor | null = null;
    for (let index = 0; index < REGISTERED_CLASSES.length; index += 1) {
        const constructor = REGISTERED_CLASSES[index]!;
        const reader = CLASS_CONSTRUCTION_TARGETS.get(constructor);
        if (!reader) continue;
        let candidate: RuntimeConstructor | null;
        try { candidate = reader(value); } catch { return null; }
        if (candidate === null) continue;
        if (!CLASS_TOKENS.has(candidate) || (result !== null && result !== candidate)) return null;
        result = candidate;
    }
    return result;
}

function constructorIsSubtype(subtype: RuntimeConstructor, supertype: RuntimeConstructor): boolean {
    const subtypeToken = CLASS_TOKENS.get(subtype);
    const supertypeToken = CLASS_TOKENS.get(supertype);
    return !!subtypeToken && !!supertypeToken && (subtypeToken === supertypeToken
        || (requireKind(subtypeToken, ["class"]).referenceClosure ?? []).includes(supertypeToken as object));
}

function classValueMatches(value: unknown, requested: RuntimeConstructor): boolean {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
    const pending = pendingConstructionTarget(value);
    if (pending !== null) return constructorIsSubtype(pending, requested);
    for (let index = 0; index < REGISTERED_CLASSES.length; index += 1) {
        const candidate = REGISTERED_CLASSES[index]!;
        if (!constructorIsSubtype(candidate as RuntimeConstructor, requested)) continue;
        try { if (CLASS_PREDICATES.get(candidate)!(value)) return true; } catch { /* fail closed */ }
    }
    return false;
}

function stableRuntimeTypeName(name: unknown): name is string {
    return typeof name === "string" && name.length > 0 && name.trim() === name
        && !/[\u0000-\u001f\u007f]/.test(name);
}

function createTypeToken<T>(kind: AS3RuntimeTypeKind, name: string,
    test: (value: unknown) => value is T, referenceClosure?: readonly object[]): AS3TypeToken<T> {
    if (!stableRuntimeTypeName(name) || typeof test !== "function") {
        throw new TypeError("AS3 runtime type requires a stable name and predicate");
    }
    const token = Object.freeze({ name });
    TYPE_TOKENS.add(token);
    TYPE_DETAILS.set(token, Object.freeze({ kind, test, ...(referenceClosure === undefined ? {} : {referenceClosure}) }));
    return token;
}

function requireToken<T>(value: AS3TypeToken<T>): TypeDetails<T> {
    if ((typeof value !== "object" && typeof value !== "function") || value === null || !TYPE_TOKENS.has(value)) {
        throw new TypeError("value is not an authenticated token for an AS3 runtime type");
    }
    return TYPE_DETAILS.get(value as object)! as TypeDetails<T>;
}

function requireKind<T>(value: AS3TypeToken<T>, allowed: readonly AS3RuntimeTypeKind[]): TypeDetails<T> {
    const details = requireToken(value);
    if (!allowed.includes(details.kind)) throw new TypeError(`wrong token kind: AS3 runtime type ${details.kind} is not allowed here`);
    return details;
}

function interfaceClosure(value: AS3TypeToken<object>): readonly object[] {
    return requireKind(value, ["interface"]).referenceClosure ?? [];
}

export function isReferenceSubtype(subtype: AS3TypeToken<object>, supertype: AS3TypeToken<object>): boolean {
    const source = requireKind(subtype, ["class", "interface"]);
    requireKind(supertype, ["class", "interface"]);
    return subtype === supertype || (source.referenceClosure ?? []).includes(supertype as object);
}

const BUILTIN_CLASS_CONSTRUCTORS = new Set<Function>([Object, Array, Number, Boolean, String, Function]);

export const AS3Types = Object.freeze({
    int: createTypeToken<number>("primitive", "int", (value): value is number => typeof value === "number"
        && Number.isFinite(value) && Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff),
    uint: createTypeToken<number>("primitive", "uint", (value): value is number => typeof value === "number"
        && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 0xffffffff),
    Number: createTypeToken<number>("primitive", "Number", (value): value is number => typeof value === "number"),
    Boolean: createTypeToken<boolean>("primitive", "Boolean", (value): value is boolean => typeof value === "boolean"),
    String: createTypeToken<string>("primitive", "String", (value): value is string => typeof value === "string"),
    Array: createTypeToken<unknown[]>("primitive", "Array", Array.isArray),
    Function: createTypeToken<Function>("primitive", "Function", (value): value is Function =>
        typeof value === "function" && !BUILTIN_CLASS_CONSTRUCTORS.has(value) && !CLASS_TOKENS.has(value)),
    Class: createTypeToken<AS3ClassValue>("primitive", "Class", (value): value is AS3ClassValue =>
        (typeof value === "function" && (BUILTIN_CLASS_CONSTRUCTORS.has(value) || CLASS_TOKENS.has(value)))
        || ((typeof value === "object" || typeof value === "function") && value !== null && TYPE_TOKENS.has(value))),
    Object: createTypeToken<unknown>("primitive", "Object", (value): value is unknown =>
        value !== null && value !== undefined),
});

function requireSealed(): void {
    if (authorityState !== "sealed") throw new TypeError("AS3 type authority is not sealed before application evaluation");
}

export function lookupClassType<T extends object>(name: string, constructor: RuntimeConstructor<T>): AS3TypeToken<T> {
    requireSealed();
    if (typeof constructor !== "function") throw new TypeError("AS3 class type requires a constructor");
    const byName = CLASS_BY_QNAME.get(name);
    if (!byName || byName.constructor !== constructor || CLASS_TOKENS.get(constructor) !== byName.token) {
        throw new TypeError("AS3 class type is not an exactly registered class");
    }
    return byName.token as AS3TypeToken<T>;
}

export function lookupInterfaceType<T extends object>(name: string): AS3TypeToken<T> {
    requireSealed();
    const token = INTERFACE_TOKENS.get(name);
    if (!token) throw new TypeError(`AS3 interface type ${name} is not registered`);
    return token as AS3TypeToken<T>;
}

export function lookupNamedReferenceType<T extends object>(name: string): AS3TypeToken<T> {
    requireSealed();
    const token = INTERFACE_TOKENS.get(name) ?? CLASS_BY_QNAME.get(name)?.token;
    if (!token) throw new TypeError(`AS3 reference type ${name} is not registered`);
    return token as AS3TypeToken<T>;
}

export function testType<T>(value: unknown, type: AS3TypeToken<T>): value is T {
    return value !== null && value !== undefined && requireToken(type).test(value);
}

export function asType<T>(value: unknown, type: AS3TypeToken<T>): T | null {
    if (value === null || value === undefined) return null;
    return requireToken(type).test(value) ? value : null;
}

/** Reference slots and explicit class/interface casts use the same nominal test. */
export function castReference<T extends object>(value: unknown, type: AS3TypeToken<T>): T | null {
    const details = requireKind(type, ["class", "interface"]);
    if (value === null || value === undefined) return null;
    if (details.test(value)) return value;
    // Native object diagnostic addresses are process-specific. Never invoke
    // source conversion hooks merely to construct a rejected-cast diagnostic.
    const error = new TypeError(`Error #1034: Type Coercion failed: cannot convert value to ${type.name}.`);
    Object.defineProperty(error, "errorID", {value:1034});
    throw error;
}

export function referenceType<T extends object>(name: string,
    runtimeValue: RuntimeConstructor<T> | AS3TypeToken<T>): AS3TypeToken<T> {
    if (typeof runtimeValue === "function") return lookupClassType(name, runtimeValue as RuntimeConstructor<T>);
    requireKind(runtimeValue, ["class", "interface"]);
    if (runtimeValue.name !== name || lookupNamedReferenceType(name) !== runtimeValue) {
        throw new TypeError("AS3 reference value has a different identity");
    }
    return runtimeValue;
}

/** Read-only construction admission used by emitted constructors; it cannot brand or register a value. */
export function canConstructAs(newTarget: unknown, declared: RuntimeConstructor): boolean {
    requireSealed();
    return typeof newTarget === "function" && CLASS_TOKENS.has(newTarget)
        && CLASS_TOKENS.has(declared) && constructorIsSubtype(newTarget as RuntimeConstructor, declared);
}

function validConstructionProof(constructor: RuntimeConstructor, proof: unknown): boolean {
    const predicate = CLASS_CONSTRUCTION_PROOFS.get(constructor);
    if (!predicate) return false;
    try { return predicate(proof); } catch { return false; }
}

/** Zero-argument spread seam used immediately before a generated derived super call. */
export function prepareConstruction(newTarget: unknown, declared: RuntimeConstructor, proof: unknown): readonly [] {
    requireSealed();
    if (typeof newTarget !== "function" || !CLASS_TOKENS.has(newTarget) || !CLASS_TOKENS.has(declared)
        || !constructorIsSubtype(newTarget as RuntimeConstructor, declared) || !validConstructionProof(declared, proof)) {
        throw new TypeError("AS3 derived construction proof is invalid");
    }
    const target = newTarget as RuntimeConstructor;
    if (target === declared) {
        const frame = constructionFrame(target);
        PREPARED_CONSTRUCTION_FRAMES.push(frame);
        return frame as unknown as readonly [];
    }
    const frame = PREPARED_CONSTRUCTION_FRAMES[PREPARED_CONSTRUCTION_FRAMES.length - 1];
    if (frame === undefined || frame.target !== target || frame.state !== "prepared") {
        throw new TypeError("AS3 derived construction proof is missing or belongs to another allocation");
    }
    return frame as unknown as readonly [];
}

/** Cancels a prepared proof when the target constructor's super call throws before allocation entry. */
export function cancelPreparedConstruction(newTarget: unknown, proof: unknown, frameValue: unknown): void {
    requireSealed();
    if (typeof newTarget !== "function" || !validConstructionProof(newTarget as RuntimeConstructor, proof)
        || (typeof frameValue !== "object" && typeof frameValue !== "function") || frameValue === null
        || !AUTHENTIC_CONSTRUCTION_FRAMES.has(frameValue as object)) {
        throw new TypeError("AS3 prepared construction cancellation is invalid");
    }
    const frame = frameValue as PreparedConstructionFrame;
    if (frame.target !== newTarget) throw new TypeError("AS3 prepared construction cancellation changed target");
    if (frame.state === "consumed" || frame.state === "cancelled") return;
    if (PREPARED_CONSTRUCTION_FRAMES[PREPARED_CONSTRUCTION_FRAMES.length - 1] !== frame) {
        throw new TypeError("AS3 prepared construction cancellation is out of order");
    }
    PREPARED_CONSTRUCTION_FRAMES.pop();
    frame.state = "cancelled";
}

/** Authenticates a generated constructor phase without exposing a brand/adopt operation. */
export function enterConstruction(value: object, newTarget: unknown,
    declared: RuntimeConstructor, proof: unknown): void {
    requireSealed();
    if ((typeof value !== "object" && typeof value !== "function") || value === null
        || typeof newTarget !== "function" || !CLASS_TOKENS.has(newTarget) || !CLASS_TOKENS.has(declared)
        || !constructorIsSubtype(newTarget as RuntimeConstructor, declared) || !validConstructionProof(declared, proof)) {
        throw new TypeError("AS3 constructor entry is not authenticated");
    }
    const target = newTarget as RuntimeConstructor;
    const existing = ACTIVE_CONSTRUCTIONS.get(value);
    if (existing !== undefined) {
        if (existing !== target) throw new TypeError("AS3 constructor entry changed allocation identity");
        return;
    }
    const frame = PREPARED_CONSTRUCTION_FRAMES[PREPARED_CONSTRUCTION_FRAMES.length - 1];
    if (frame !== undefined && frame.target === target && frame.state === "prepared") {
        PREPARED_CONSTRUCTION_FRAMES.pop();
        frame.state = "consumed";
    } else if (target !== declared) {
        throw new TypeError("AS3 constructor entry lacks the target constructor handoff");
    }
    ACTIVE_CONSTRUCTIONS.set(value, target);
}

/** Removes an in-flight identity after a generated constructor throws. */
export function abortConstruction(value: object, newTarget: unknown,
    declared: RuntimeConstructor, proof: unknown): void {
    requireSealed();
    if (typeof newTarget !== "function" || !validConstructionProof(declared, proof)
        || ACTIVE_CONSTRUCTIONS.get(value) !== newTarget) {
        throw new TypeError("AS3 constructor abort is not authenticated");
    }
    ACTIVE_CONSTRUCTIONS.delete(value);
}

/** Closes the allocation proof only in the exact most-derived generated constructor. */
export function completeConstruction(value: object, newTarget: unknown,
    declared: RuntimeConstructor, proof: unknown): void {
    requireSealed();
    if (newTarget !== declared || !validConstructionProof(declared, proof)
        || ACTIVE_CONSTRUCTIONS.get(value) !== declared) {
        throw new TypeError("AS3 constructor completion is not authenticated");
    }
    ACTIVE_CONSTRUCTIONS.delete(value);
}

/** Initializes authenticated AS3 slots once, before the first base constructor user statement. */
export function initializeInstanceFields(value: object, newTarget: RuntimeConstructor): void {
    requireSealed();
    if ((typeof value !== "object" && typeof value !== "function") || value === null
        || typeof newTarget !== "function" || !CLASS_TOKENS.has(newTarget)
        || ACTIVE_CONSTRUCTIONS.get(value) !== newTarget || pendingConstructionTarget(value) !== newTarget) {
        throw new TypeError("AS3 construction field initialization requires one authenticated pending allocation");
    }
    if (INITIALIZED_INSTANCE_FIELDS.has(value)) return;
    const chain: RuntimeConstructor[] = [];
    for (let current: RuntimeConstructor | null = newTarget; current !== null; current = CLASS_BASES.get(current) ?? null) {
        chain.push(current);
    }
    chain.reverse().forEach(constructor => CLASS_FIELD_DEFAULTS.get(constructor)?.forEach(field => {
        const initial = field.policy === "zero" ? 0 : field.policy === "nan" ? 0 / 0
            : field.policy === "false" ? false : field.policy === "null" ? null : undefined;
        Object.defineProperty(value, field.name, { value: initial, writable: true, enumerable: true, configurable: true });
    }));
    INITIALIZED_INSTANCE_FIELDS.add(value);
}

export function registerVectorType<T extends object>(name: string, policy: object,
    predicate: (value: unknown) => boolean): AS3TypeToken<T> {
    if (!stableRuntimeTypeName(name) || typeof policy !== "object" || policy === null || typeof predicate !== "function") {
        throw new TypeError("AS3 Vector runtime type requires a stable name, policy, and module-owned predicate");
    }
    const cached = VECTOR_TYPE_TOKENS.get(policy);
    if (cached) {
        if (VECTOR_TYPE_NAMES.get(policy) !== name || VECTOR_TYPE_PREDICATES.get(policy) !== predicate) {
            throw new TypeError("AS3 Vector policy has a different sealed registration");
        }
        return cached as AS3TypeToken<T>;
    }
    const created = createTypeToken<T>("vector", name, (value): value is T => {
        if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
        try { return predicate(value); } catch { return false; }
    });
    VECTOR_TYPE_TOKENS.set(policy, created as AS3TypeToken<object>);
    VECTOR_TYPE_NAMES.set(policy, name);
    VECTOR_TYPE_PREDICATES.set(policy, predicate);
    return created;
}

function exactKeys(value: object, keys: readonly string[], label: string): void {
    const actual = Object.keys(value);
    if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
        throw new TypeError(`${label} has non-canonical keys or order`);
    }
}

function validateQNameList(value: readonly string[], label: string): void {
    if (!Array.isArray(value) || value.some(item => !stableRuntimeTypeName(item))
        || new Set(value).size !== value.length) throw new TypeError(`${label} must be a unique stable QName list`);
}

function canonicalAuthorityMetadata(document: AS3TypeAuthorityDocument): string {
    return JSON.stringify({
        schema: document.schema,
        qnames: document.qnames,
        entries: document.entries.map(entry => entry.kind === "interface"
            ? { kind: entry.kind, qname: entry.qname, bases: entry.bases }
            : { kind: entry.kind, qname: entry.qname, base: entry.base, interfaces: entry.interfaces,
                sourceSha256: entry.sourceSha256, fields: entry.fields, ...(entry.objectTraits ? {objectTraits:entry.objectTraits} : {}), ...(entry.nativeObjectTraits ? {nativeObjectTraits:entry.nativeObjectTraits} : {}) }),
    });
}

// Synchronous SHA-256 keeps authority validation deterministic in browsers and
// does not depend on WebCrypto availability during module evaluation.
function sha256Ascii(value: string): string {
    const bytes = new TextEncoder().encode(value);
    const bitLength = bytes.length * 8;
    const paddedLength = ((bytes.length + 9 + 63) >>> 6) << 6;
    const data = new Uint8Array(paddedLength);
    data.set(bytes);
    data[bytes.length] = 0x80;
    const view = new DataView(data.buffer);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const k = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    const w = new Uint32Array(64);
    const rr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
    for (let offset = 0; offset < data.length; offset += 64) {
        for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
        for (let i = 16; i < 64; i += 1) {
            const a = w[i - 15]!; const b = w[i - 2]!;
            const s0 = rr(a, 7) ^ rr(a, 18) ^ (a >>> 3);
            const s1 = rr(b, 17) ^ rr(b, 19) ^ (b >>> 10);
            w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
        }
        let [a,b,c,d,e,f,g,hh] = Array.from(h) as number[];
        for (let i = 0; i < 64; i += 1) {
            const s1 = rr(e!, 6) ^ rr(e!, 11) ^ rr(e!, 25);
            const ch = (e! & f!) ^ (~e! & g!);
            const t1 = (hh! + s1 + ch + k[i]! + w[i]!) >>> 0;
            const s0 = rr(a!, 2) ^ rr(a!, 13) ^ rr(a!, 22);
            const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
            const t2 = (s0 + maj) >>> 0;
            hh=g; g=f; f=e; e=(d!+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
        }
        const vals=[a,b,c,d,e,f,g,hh]; for(let i=0;i<8;i+=1) h[i]=(h[i]!+vals[i]!)>>>0;
    }
    return Array.from(h).map(value => value.toString(16).padStart(8, "0")).join("");
}

/** Package-internal: the package export map intentionally does not expose this module. */
export function installAS3TypeAuthority(document: AS3TypeAuthorityDocument): void {
    if (authorityState !== "open") throw new TypeError("AS3 type authority is already installing or sealed");
    authorityState = "installing";
    try {
        exactKeys(document as unknown as object, ["schema", "sha256", "qnames", "entries"], "AS3 authority");
        if (document.schema !== "as3-runtime-type-authority@1" || !/^[0-9a-f]{64}$/.test(document.sha256)) {
            throw new TypeError("AS3 authority schema or SHA-256 is invalid");
        }
        validateQNameList(document.qnames, "AS3 authority qnames");
        if (!Array.isArray(document.entries) || document.entries.length !== document.qnames.length) {
            throw new TypeError("AS3 authority entry set does not match its exact QName set");
        }
        if (sha256Ascii(canonicalAuthorityMetadata(document)) !== document.sha256) {
            throw new TypeError("AS3 authority canonical SHA-256 does not match its metadata");
        }
        const seen = new Set<string>();
        document.entries.forEach((entry, index) => {
            if (!entry || typeof entry !== "object" || entry.qname !== document.qnames[index]
                || !stableRuntimeTypeName(entry.qname) || seen.has(entry.qname)
                || INTERFACE_TOKENS.has(entry.qname) || CLASS_BY_QNAME.has(entry.qname)) {
                throw new TypeError("AS3 authority has duplicate, drifted, or out-of-order QName identity");
            }
            if (entry.kind === "interface") {
                exactKeys(entry as unknown as object, ["kind", "qname", "bases"], `AS3 interface ${entry.qname}`);
                validateQNameList(entry.bases, `AS3 interface ${entry.qname} bases`);
                const bases = entry.bases.map((name: string) => {
                    if (!seen.has(name)) throw new TypeError(`AS3 interface ${entry.qname} has a missing, cyclic, or out-of-order base`);
                    const base = INTERFACE_TOKENS.get(name);
                    if (!base) throw new TypeError(`AS3 interface ${entry.qname} base is not an interface`);
                    return base;
                });
                const closure = new Set<object>();
                bases.forEach((base: AS3TypeToken<object>) => {
                    closure.add(base); interfaceClosure(base).forEach(item => closure.add(item));
                });
                let token: AS3TypeToken<object>;
                const sealedClosure = Object.freeze(Array.from(closure));
                token = createTypeToken<object>("interface", entry.qname, (value): value is object => {
                    if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
                    for (const constructor of REGISTERED_CLASSES) {
                        if (!CLASS_INTERFACES.get(constructor)?.includes(token)) continue;
                        if (classValueMatches(value, constructor as RuntimeConstructor)) return true;
                    }
                    return false;
                }, sealedClosure);
                INTERFACE_TOKENS.set(entry.qname, token);
            } else if (entry.kind === "class") {
                exactKeys(entry as unknown as object, ["kind", "qname", "base", "interfaces", "sourceSha256", "fields", ...(entry.objectTraits ? ["objectTraits"] : []), ...(entry.nativeObjectTraits ? ["nativeObjectTraits"] : []), "constructor", "predicate", "constructionTarget", "constructionProof"],
                    `AS3 class ${entry.qname}`);
                if (entry.base !== null && (!seen.has(entry.base) || !CLASS_BY_QNAME.has(entry.base))) {
                    throw new TypeError(`AS3 class ${entry.qname} has a missing, cyclic, or out-of-order class base`);
                }
                validateQNameList(entry.interfaces, `AS3 class ${entry.qname} interfaces`);
                const localConstruction = typeof entry.constructionTarget === "function" && typeof entry.constructionProof === "function";
                const mappedConstruction = entry.constructionTarget === null && entry.constructionProof === null;
                if (!/^[0-9a-f]{64}$/.test(entry.sourceSha256) || typeof entry.constructor !== "function" || typeof entry.predicate !== "function"
                    || !Array.isArray(entry.fields) || entry.fields.some((field: AS3ClassAuthorityEntry["fields"][number]) => !field || typeof field !== "object"
                        || Object.keys(field).join("\0") !== "name\0policy" || !stableRuntimeTypeName(field.name)
                        || !["zero", "nan", "false", "null", "undefined"].includes(field.policy))
                    || new Set(entry.fields.map((field: AS3ClassAuthorityEntry["fields"][number]) => field.name)).size !== entry.fields.length
                    || (!localConstruction && !mappedConstruction)
                    || CLASS_TOKENS.has(entry.constructor)) throw new TypeError(`AS3 class ${entry.qname} identity is invalid or reused`);
                const closure = new Set<object>();
                if (entry.base !== null) {
                    const baseToken = CLASS_BY_QNAME.get(entry.base)!.token;
                    closure.add(baseToken);
                    (requireKind(baseToken, ["class"]).referenceClosure ?? []).forEach(item => closure.add(item));
                    CLASS_INTERFACES.get(CLASS_BY_QNAME.get(entry.base)!.constructor)?.forEach(item => closure.add(item));
                }
                entry.interfaces.forEach((name: string) => {
                    if (!seen.has(name)) throw new TypeError(`AS3 class ${entry.qname} has a missing or out-of-order interface`);
                    const token = INTERFACE_TOKENS.get(name);
                    if (!token) throw new TypeError(`AS3 class ${entry.qname} interface reference is not an interface`);
                    closure.add(token); interfaceClosure(token).forEach(item => closure.add(item));
                });
                const predicate = entry.predicate;
                let token: AS3TypeToken<object>;
                token = createTypeToken<object>("class", entry.qname,
                    (value): value is object => classValueMatches(value, entry.constructor),
                    Object.freeze(Array.from(closure)));
                CLASS_TOKENS.set(entry.constructor, token);
                CLASS_BY_QNAME.set(entry.qname, Object.freeze({ constructor: entry.constructor, token }));
                CLASS_INTERFACES.set(entry.constructor, Object.freeze(Array.from(closure)));
                CLASS_PREDICATES.set(entry.constructor, predicate);
                if (entry.constructionTarget !== null) CLASS_CONSTRUCTION_TARGETS.set(entry.constructor, entry.constructionTarget);
                if (entry.constructionProof !== null) CLASS_CONSTRUCTION_PROOFS.set(entry.constructor, entry.constructionProof);
                CLASS_FIELD_DEFAULTS.set(entry.constructor, Object.freeze(entry.fields.map(
                    (field: AS3ClassAuthorityEntry["fields"][number]) => Object.freeze({ ...field }))));
                if (entry.objectTraits) {
                    const traits = entry.objectTraits;
                    exactKeys(traits, ["dynamic", "members"], "AS3 Object traits");
                    if (typeof traits.dynamic !== "boolean" || !Array.isArray(traits.members)) throw new TypeError("Invalid AS3 Object traits");
                    const names = new Set<string>();
                    traits.members.forEach((member:AS3ObjectTraits["members"][number]) => {
                        exactKeys(member, ["name", "kind", "type", "visibility", "namespaceName"], "AS3 Object member");
                        if (!stableRuntimeTypeName(member.name) || !stableRuntimeTypeName(member.type)
                            || !["field", "const", "method", "getter", "setter"].includes(member.kind)
                            || !["public", "private", "protected", "internal", "namespace"].includes(member.visibility)
                            || (member.namespaceName !== null && !stableRuntimeTypeName(member.namespaceName))
                            || (member.visibility === "namespace") !== (member.namespaceName !== null)
                            || names.has(JSON.stringify([member.name,member.kind,member.visibility,member.namespaceName]))) throw new TypeError("Invalid AS3 Object member");
                        names.add(JSON.stringify([member.name,member.kind,member.visibility,member.namespaceName]));
                    });
                }
                if (entry.nativeObjectTraits) {
                    const traits=entry.nativeObjectTraits;
                    exactKeys(traits,["dynamic","names","sourceArtifactSha256"],"AS3 native Object census");
                    if (entry.objectTraits || traits.dynamic !== null && typeof traits.dynamic !== "boolean"
                        || !/^[a-f0-9]{64}$/.test(traits.sourceArtifactSha256)) throw new TypeError("Invalid AS3 native Object census");
                    validateQNameList(traits.names,"AS3 native member names");
                }
                CLASS_OBJECT_ENTRIES.set(entry.constructor, Object.freeze({qname:entry.qname,
                    nativeTraits:entry.nativeObjectTraits ? Object.freeze({...entry.nativeObjectTraits,names:Object.freeze([...entry.nativeObjectTraits.names])}) : null, traits:entry.objectTraits
                    ? Object.freeze({dynamic:entry.objectTraits.dynamic,
                        members:Object.freeze(entry.objectTraits.members.map((member:AS3ObjectTraits["members"][number]) => Object.freeze({...member})))}) : null}));
                CLASS_BASES.set(entry.constructor, entry.base === null ? null : CLASS_BY_QNAME.get(entry.base)!.constructor);
                REGISTERED_CLASSES.push(entry.constructor);
            } else {
                throw new TypeError("AS3 authority contains an unknown entry kind");
            }
            seen.add(entry.qname);
        });
        installedAuthoritySha256 = document.sha256;
        authorityState = "sealed";
    } catch (error) {
        // Installation happens before application evaluation. A failed partial
        // install is permanently poisoned rather than permitting retry/widening.
        throw error;
    }
}

export function authorityStatus(): Readonly<{ sealed: boolean; sha256: string | null }> {
    return Object.freeze({ sealed: authorityState === "sealed", sha256: installedAuthoritySha256 });
}

/** Resolve only registered allocation identities; never infer traits from JS fields. */
export function lookupObjectClass(value: unknown): Readonly<{qname:string; constructor:RuntimeConstructor;
    chain:readonly Readonly<{qname:string; traits:AS3ObjectTraits | null; nativeTraits:AS3NativeObjectTraits | null}>[]}> | null {
    requireSealed();
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return null;
    let selected: RuntimeConstructor | null = pendingConstructionTarget(value);
    if (selected === null) for (const candidate of REGISTERED_CLASSES) {
        let matches = false;
        try { matches = CLASS_PREDICATES.get(candidate)!(value); } catch { /* no forged identity */ }
        if (!matches) continue;
        if (selected === null || constructorIsSubtype(candidate as RuntimeConstructor, selected)) selected = candidate as RuntimeConstructor;
        else if (!constructorIsSubtype(selected, candidate as RuntimeConstructor)) throw new TypeError("Ambiguous AS3 Object class identity");
    }
    if (selected === null) return null;
    const chain = [];
    for (let current:RuntimeConstructor | null = selected; current !== null; current = CLASS_BASES.get(current) ?? null)
        chain.push(CLASS_OBJECT_ENTRIES.get(current)!);
    return Object.freeze({qname:chain[0]!.qname, constructor:selected, chain:Object.freeze(chain)});
}

/** Lexical callers come from generated class identity, not the receiver's fields. */
export function lookupObjectCaller(qname: string): readonly string[] {
    requireSealed();
    const owner = CLASS_BY_QNAME.get(qname);
    if (!owner || !CLASS_OBJECT_ENTRIES.get(owner.constructor)?.traits)
        throw new TypeError("AS3 Object caller lacks authenticated local traits");
    const result:string[] = [];
    for (let current:RuntimeConstructor | null = owner.constructor; current !== null; current = CLASS_BASES.get(current) ?? null)
        result.push(CLASS_OBJECT_ENTRIES.get(current)!.qname);
    return Object.freeze(result);
}

/** Class string labels come only from builtin or authenticated runtime identity. */
export function lookupStringClassName(value:unknown):string | null {
    if (typeof value === "function") {
        const builtin = [Object,Array,Number,Boolean,String,Function].find(item => item === value);
        if (builtin) return builtin.name;
        requireSealed();
        return CLASS_OBJECT_ENTRIES.get(value)?.qname ?? null;
    }
    if (value !== null && typeof value === "object" && TYPE_TOKENS.has(value))
        return (value as AS3TypeToken<unknown>).name;
    return null;
}

/** Authenticate deferred class initialization after the complete type authority seals. */
export function classInitializationBase(constructor: unknown, proof: unknown): RuntimeConstructor | null {
    requireSealed();
    if (typeof constructor !== "function" || !CLASS_TOKENS.has(constructor) || !validConstructionProof(constructor as RuntimeConstructor, proof))
        throw new TypeError("AS3 class initialization lacks sealed construction authority");
    return CLASS_BASES.get(constructor) ?? null;
}


/** Read-only dynamic construction lookup; never adopts host constructors. */
export function lookupDynamicConstruction(value:unknown):RuntimeConstructor | string | null {
    requireSealed();
    if (typeof value === "function" && CLASS_TOKENS.has(value)) return value as RuntimeConstructor;
    if (value !== null && typeof value === "object" && TYPE_DETAILS.get(value)?.kind === "interface")
        return (value as AS3TypeToken<unknown>).name;
    return null;
}

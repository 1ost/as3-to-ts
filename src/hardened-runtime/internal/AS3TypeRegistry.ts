import { AS3FileLocalClassScope, fileLocalClassIdentity } from "./AS3FileLocalIdentity";

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
    readonly final?: true;
    readonly members: readonly { readonly name: string;
        readonly kind: "field" | "const" | "method" | "getter" | "setter"; readonly type: string;
        readonly visibility: "public" | "private" | "protected" | "internal" | "namespace"; readonly namespaceName:string | null }[];
}

export interface AS3NativeObjectTraits {
    readonly dynamic: boolean | null;
    readonly names: readonly string[];
    readonly sourceArtifactSha256: string;
}

/** Optional generated-source authority; not a claim about arbitrary host Class values. */
export interface AS3StaticCallTraits {
    readonly methods: readonly {readonly name:string; readonly visibility:"public"|"private"|"protected"|"internal";
        readonly required:number; readonly total:number; readonly rest:boolean; readonly parameterTypes:readonly string[]}[];
    readonly noncallableNames: readonly string[];
    readonly unsupportedNames: readonly string[];
}
type StaticCallAuthority=Readonly<{methods:readonly Readonly<AS3StaticCallTraits["methods"][number] & {callable:Function}>[];
    noncallableNames:readonly string[];unsupportedNames:readonly string[]}>;
const STATIC_CALLS = new WeakMap<Function, StaticCallAuthority>();

export interface AS3StaticReflectionTraits {
    readonly variables: readonly { readonly name: string; readonly type: string }[];
}
export interface AS3StaticReflectionDescriptor {
    readonly qualifiedName: string;
    readonly staticVariables: AS3StaticReflectionTraits["variables"];
}
const STATIC_REFLECTION = new WeakMap<Function, AS3StaticReflectionDescriptor>();

export interface AS3ClassAuthorityEntry {
    readonly kind: "class";
    readonly qname: string;
    readonly base: string | null;
    readonly interfaces: readonly string[];
    readonly sourceSha256: string;
    readonly fileLocalScope?: AS3FileLocalClassScope;
    readonly staticReflection?: AS3StaticReflectionTraits;
    readonly staticCallTraits?: AS3StaticCallTraits;
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

export interface AS3PrimaryTypeAuthorityReservation {
    readonly schema:"as3-primary-type-authority-reservation@1";
    readonly typeAuthoritySha256:string;
    readonly qnames:readonly string[];
}

export interface AS3TypeAuthorityCommitReceipt {
    readonly schema:"as3-type-authority-commit-receipt@1";
    readonly typeAuthoritySha256:string;
}

export interface AS3SecondaryTypeAuthorityDocument {
    readonly schema:"as3-runtime-secondary-type-authority@1";
    readonly primarySha256:string;
    readonly sha256:string;
    readonly qnames:readonly string[];
    readonly entries:readonly AS3AuthorityEntry[];
}

export interface AS3SecondaryTypeAuthorityReservation {
    readonly primarySha256:string;
    readonly sha256:string;
    readonly qnames:readonly string[];
}

export interface AS3SecondaryTypeAuthorityLease {
    readonly primarySha256:string;
    readonly sha256:string;
    readonly qnames:readonly string[];
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
interface ClassObjectEntry {
    readonly qname: string;
    readonly reflectionName: string;
    readonly diagnosticName: string;
    readonly localName: string;
    readonly packageName: string;
    readonly traits: AS3ObjectTraits | null;
    readonly nativeTraits: AS3NativeObjectTraits | null;
}
const CLASS_OBJECT_ENTRIES = new WeakMap<Function, Readonly<ClassObjectEntry>>();
const CLASS_BASES = new WeakMap<Function, RuntimeConstructor | null>();
const REGISTERED_CLASSES: Function[] = [];
const INTERFACE_TOKENS = new Map<string, AS3TypeToken<object>>();
const VECTOR_TYPE_TOKENS = new WeakMap<object, AS3TypeToken<object>>();
const VECTOR_TYPE_NAMES = new WeakMap<object, string>();
const VECTOR_TYPE_PREDICATES = new WeakMap<object, (value: unknown) => boolean>();
let authorityState: "open" | "validating" | "reserved" | "installing" | "sealed" | "poisoned" = "open";
let installedAuthoritySha256: string | null = null;
interface PrimaryValidationGuard {compromised:boolean}
let activePrimaryValidation:PrimaryValidationGuard|null=null;
interface PrimaryMutation {applied:boolean;readonly undo:()=>void}
interface PrimaryOwner {
    readonly reservation:AS3PrimaryTypeAuthorityReservation;
    readonly receipt:AS3TypeAuthorityCommitReceipt;
    readonly plan:readonly SecondaryPublication[];
    readonly qnameEntries:ReadonlyMap<RuntimeConstructor,Readonly<{constructor:RuntimeConstructor;token:AS3TypeToken<object>}>>;
    readonly journal:PrimaryMutation[];
    state:"reserved"|"installing"|"committed"|"aborted"|"poisoned";
}
let activePrimaryOwner:PrimaryOwner|null=null;
const AUTHENTIC_PRIMARY_RESERVATIONS=new WeakSet<object>();
const PRIMARY_RESERVATION_OWNERS=new WeakMap<object,PrimaryOwner>();
const AUTHENTIC_PRIMARY_RECEIPTS=new WeakSet<object>();
let activeSecondaryReservation:AS3SecondaryTypeAuthorityReservation|null=null;
const AUTHENTIC_SECONDARY_RESERVATIONS=new WeakSet<object>();
const SECONDARY_MUTATION_SURFACES=Object.freeze([
    "TYPE_TOKENS","TYPE_DETAILS","CLASS_TOKENS","CLASS_BY_QNAME","CLASS_INTERFACES","CLASS_PREDICATES",
    "CLASS_CONSTRUCTION_TARGETS","CLASS_CONSTRUCTION_PROOFS","CLASS_FIELD_DEFAULTS","STATIC_CALLS","STATIC_REFLECTION",
    "CLASS_OBJECT_ENTRIES","CLASS_BASES","REGISTERED_CLASSES","INTERFACE_TOKENS","INITIALIZED_INSTANCE_FIELDS",
    "ACTIVE_CONSTRUCTIONS","PREPARED_CONSTRUCTION_FRAMES","AUTHENTIC_CONSTRUCTION_FRAMES",
] as const);
export type AS3SecondaryMutationSurface=typeof SECONDARY_MUTATION_SURFACES[number];
interface SecondaryInterfacePublication {readonly kind:"interface";readonly qname:string;
    readonly token:AS3TypeToken<object>;readonly details:TypeDetails<object>}
interface SecondaryClassPublication {readonly kind:"class";readonly qname:string;
    readonly constructor:RuntimeConstructor;readonly token:AS3TypeToken<object>;readonly details:TypeDetails<object>;
    readonly interfaces:readonly object[];readonly predicate:(value:unknown)=>boolean;
    readonly constructionTarget:((value:unknown)=>RuntimeConstructor|null)|null;
    readonly constructionProof:((value:unknown)=>boolean)|null;
    readonly fields:AS3ClassAuthorityEntry["fields"];readonly staticCalls:StaticCallAuthority|null;
    readonly staticReflection:AS3StaticReflectionDescriptor|null;readonly objectEntry:Readonly<ClassObjectEntry>;
    readonly base:RuntimeConstructor|null}
type SecondaryPublication=SecondaryInterfacePublication|SecondaryClassPublication;
interface SecondaryMutation {readonly surface:AS3SecondaryMutationSurface;readonly undo:()=>void}
interface SecondaryOwner {
    readonly reservation:AS3SecondaryTypeAuthorityReservation;
    readonly plan:readonly SecondaryPublication[];
    readonly mutations:Record<AS3SecondaryMutationSurface,number>;
    readonly journal:SecondaryMutation[];
    readonly constructors:Set<Function>;
    readonly activeInstances:Set<object>;
    readonly initializedInstances:Set<object>;
    lease:AS3SecondaryTypeAuthorityLease|null;
    state:"reserved"|"committed"|"sealed"|"poisoned"|"revoked";
    preparedConstructions:number;
    activeConstructions:number;
    initializedOrLiveInstances:number;
}
const SECONDARY_RESERVATION_OWNERS=new WeakMap<object,SecondaryOwner>();
const SECONDARY_CONSTRUCTOR_OWNERS=new WeakMap<Function,SecondaryOwner>();
const SECONDARY_INSTANCE_OWNERS=new WeakMap<object,SecondaryOwner>();
const SECONDARY_TOKEN_OWNERS=new WeakMap<object,SecondaryOwner>();
const AUTHENTIC_SECONDARY_LEASES=new WeakSet<object>();
const REVOKED_SECONDARY_CONSTRUCTORS=new WeakSet<Function>();
const INITIALIZED_INSTANCE_FIELDS = new WeakSet<object>();
const ACTIVE_CONSTRUCTIONS = new WeakMap<object, RuntimeConstructor>();
interface PreparedConstructionFrame {
    readonly target: RuntimeConstructor;
    readonly secondaryOwner:SecondaryOwner|null;
    readonly approvedMethods: Map<string, Set<Function>>;
    receiver: object | null;
    state: "prepared" | "consumed" | "cancelled";
    [Symbol.iterator](): Iterator<never>;
}
const PREPARED_CONSTRUCTION_FRAMES: PreparedConstructionFrame[] = [];
const AUTHENTIC_CONSTRUCTION_FRAMES = new WeakSet<object>();
const PRE_SUPER_RECEIVERS = new WeakMap<object, object>();
/** Only a consumed construction frame can join a preview with its allocated receiver. */
const PRE_SUPER_FINAL_RECEIVERS = new WeakMap<object, object>();

export function preSuperMethodClosureOwner(receiver: object): object {
    return PRE_SUPER_RECEIVERS.get(receiver) ?? receiver;
}

export function resolvePreSuperMethodClosureReceiver(receiver: object): object {
    return PRE_SUPER_FINAL_RECEIVERS.get(receiver) ?? receiver;
}

function adjustSecondaryMutation(owner:SecondaryOwner,surface:AS3SecondaryMutationSurface,delta:1|-1):void {
    const next=owner.mutations[surface]+delta;
    if(next<0) {owner.state="poisoned";throw new TypeError("AS3 secondary mutation ownership count underflowed");}
    owner.mutations[surface]=next;
}

function constructionFrame(target: RuntimeConstructor): PreparedConstructionFrame {
    const secondaryOwner=SECONDARY_CONSTRUCTOR_OWNERS.get(target)??null;
    const frame: PreparedConstructionFrame = {
        target,
        secondaryOwner,
        approvedMethods: new Map(),
        receiver: null,
        state: "prepared",
        [Symbol.iterator](): Iterator<never> {
            return { next(): IteratorResult<never> { return { done: true, value: undefined as never }; } };
        },
    };
    if(secondaryOwner) {
        secondaryOwner.preparedConstructions+=1;
        adjustSecondaryMutation(secondaryOwner,"PREPARED_CONSTRUCTION_FRAMES",1);
        adjustSecondaryMutation(secondaryOwner,"AUTHENTIC_CONSTRUCTION_FRAMES",1);
    }
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
    rejectPrimaryMutationDuringTransaction("create an AS3 runtime type token");
    if (!stableRuntimeTypeName(name) || typeof test !== "function") {
        throw new TypeError("AS3 runtime type requires a stable name and predicate");
    }
    const token = Object.freeze({ name });
    TYPE_TOKENS.add(token);
    TYPE_DETAILS.set(token, Object.freeze({ kind, test, ...(referenceClosure === undefined ? {} : {referenceClosure}) }));
    return token;
}

function requireToken<T>(value: AS3TypeToken<T>): TypeDetails<T> {
    if(authorityState==="poisoned")throw new TypeError("AS3 primary runtime type authority is poisoned");
    if ((typeof value !== "object" && typeof value !== "function") || value === null || !TYPE_TOKENS.has(value)) {
        throw new TypeError("value is not an authenticated token for an AS3 runtime type");
    }
    const secondaryOwner=SECONDARY_TOKEN_OWNERS.get(value as object);
    if(secondaryOwner&&(secondaryOwner.state==="poisoned"||secondaryOwner.state==="revoked"))
        throw new TypeError("AS3 secondary runtime type authority is poisoned or revoked");
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

function requireUsableSecondaryConstructor(constructor:Function):void {
    const owner=SECONDARY_CONSTRUCTOR_OWNERS.get(constructor);
    if(owner&&(owner.state==="poisoned"||owner.state==="revoked"))
        throw new TypeError("AS3 secondary constructor authority is poisoned or revoked");
}

export function lookupClassType<T extends object>(name: string, constructor: RuntimeConstructor<T>): AS3TypeToken<T> {
    requireSealed();
    if (typeof constructor !== "function") throw new TypeError("AS3 class type requires a constructor");
    requireUsableSecondaryConstructor(constructor);
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
    if (lookupNamedReferenceType(name) !== runtimeValue) {
        throw new TypeError("AS3 reference value has a different identity");
    }
    return runtimeValue;
}

/** Read-only construction admission used by emitted constructors; it cannot brand or register a value. */
export function canConstructAs(newTarget: unknown, declared: RuntimeConstructor): boolean {
    requireSealed();
    if(typeof newTarget==="function")requireUsableSecondaryConstructor(newTarget);
    requireUsableSecondaryConstructor(declared);
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
    if(typeof newTarget==="function")requireUsableSecondaryConstructor(newTarget);
    requireUsableSecondaryConstructor(declared);
    if (typeof newTarget !== "function" || !CLASS_TOKENS.has(newTarget) || !CLASS_TOKENS.has(declared)
        || !constructorIsSubtype(newTarget as RuntimeConstructor, declared) || !validConstructionProof(declared, proof)) {
        throw new TypeError("AS3 derived construction proof is invalid");
    }
    const target = newTarget as RuntimeConstructor;
    if (target === declared) {
        const existing = PREPARED_CONSTRUCTION_FRAMES[PREPARED_CONSTRUCTION_FRAMES.length - 1];
        if (existing?.target === target && existing.state === "prepared" && existing.receiver !== null) {
            return existing as unknown as readonly [];
        }
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

type PreSuperMethodProof = readonly [name: string, implementation: unknown];

function resolvedPreSuperMethod(prototype: object, name: string): Function | null {
    for (let current: object | null = prototype; current !== null; current = Object.getPrototypeOf(current)) {
        const descriptor = Object.getOwnPropertyDescriptor(current, name);
        if (descriptor !== undefined) return "value" in descriptor && typeof descriptor.value === "function"
            ? descriptor.value as Function : null;
    }
    return null;
}

/** A temporary receiver for authenticated, nonescaping local pre-super evaluation. */
export function beginPreSuperReceiver(newTarget: unknown, declared: RuntimeConstructor,
    proof: unknown, methods: readonly unknown[]): { readonly receiver: object; readonly prepared: readonly [] } {
    requireSealed();
    if (typeof newTarget === "function") requireUsableSecondaryConstructor(newTarget);
    requireUsableSecondaryConstructor(declared);
    if (typeof newTarget !== "function" || !CLASS_TOKENS.has(newTarget)
        || !CLASS_TOKENS.has(declared) || !constructorIsSubtype(newTarget as RuntimeConstructor, declared)
        || !validConstructionProof(declared, proof) || !Array.isArray(methods)) {
        throw new TypeError("AS3 pre-super receiver proof is invalid");
    }
    const target = newTarget as RuntimeConstructor;
    const declaredPrototype = Object.getOwnPropertyDescriptor(declared, "prototype")?.value;
    const targetPrototype = Object.getOwnPropertyDescriptor(target, "prototype")?.value;
    if (!declaredPrototype || typeof declaredPrototype !== "object"
        || !targetPrototype || typeof targetPrototype !== "object") {
        throw new TypeError("AS3 pre-super receiver has no class prototype");
    }
    const approved: PreSuperMethodProof[] = [];
    const names = new Set<string>();
    for (const item of methods) {
        if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== "string"
            || item[0].length === 0 || names.has(item[0]) || typeof item[1] !== "function"
            || Object.getOwnPropertyDescriptor(declaredPrototype, item[0])?.value !== item[1]) {
            throw new TypeError("AS3 pre-super method proof is invalid");
        }
        names.add(item[0]);
        approved.push(item as unknown as PreSuperMethodProof);
    }
    let frame: PreparedConstructionFrame | null = null;
    if (target !== declared) {
        const pending = PREPARED_CONSTRUCTION_FRAMES[PREPARED_CONSTRUCTION_FRAMES.length - 1];
        if (!pending || pending.target !== target || pending.state !== "prepared") {
            throw new TypeError("AS3 pre-super receiver lacks the target constructor handoff");
        }
        frame = pending;
    }
    const pinnedMethods = new Map<string, Function>();
    for (const [name, implementation] of approved) {
        const existing = frame?.approvedMethods.get(name);
        const resolved = resolvedPreSuperMethod(targetPrototype, name);
        if (resolved === null || (resolved !== implementation && !existing?.has(resolved))) {
            throw new TypeError("AS3 pre-super virtual dispatch is not authenticated");
        }
        pinnedMethods.set(name, resolved);
    }
    let receiver = frame?.receiver ?? null;
    if (receiver === null) {
        receiver = Object.create(targetPrototype) as Record<string, unknown>;
        const chain: RuntimeConstructor[] = [];
        for (let current: RuntimeConstructor | null = target; current !== null;
            current = CLASS_BASES.get(current) ?? null) chain.push(current);
        chain.reverse().forEach(constructor => CLASS_FIELD_DEFAULTS.get(constructor)?.forEach(field => {
            const initial = field.policy === "zero" ? 0 : field.policy === "nan" ? 0 / 0
                : field.policy === "false" ? false : field.policy === "null" ? null : undefined;
            Object.defineProperty(receiver, field.name,
                {value: initial, writable: true, enumerable: true, configurable: true});
        }));
    }
    for (const [name, implementation] of pinnedMethods) {
        const own = Object.getOwnPropertyDescriptor(receiver, name);
        if (own !== undefined && (!("value" in own) || own.value !== implementation)) {
            throw new TypeError("AS3 pre-super method collides with a receiver slot");
        }
    }
    for (const [name, implementation] of pinnedMethods) {
        if (Object.getOwnPropertyDescriptor(receiver, name) === undefined) {
            // Keep the authenticated virtual target stable across side effects
            // in later pre-super expressions without exposing the receiver.
            Object.defineProperty(receiver, name,
                {value: implementation, writable: false, enumerable: false, configurable: false});
        }
    }
    if (frame === null) frame = constructionFrame(target);
    frame.receiver = receiver;
    for (const [name, implementation] of approved) {
        let set = frame.approvedMethods.get(name);
        if (set === undefined) { set = new Set(); frame.approvedMethods.set(name, set); }
        set.add(implementation as Function);
    }
    if (target === declared) PREPARED_CONSTRUCTION_FRAMES.push(frame);
    return {receiver, prepared: frame as unknown as readonly []};
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
    if (frame.secondaryOwner) {
        frame.secondaryOwner.preparedConstructions -= 1;
        adjustSecondaryMutation(frame.secondaryOwner,"PREPARED_CONSTRUCTION_FRAMES",-1);
        AUTHENTIC_CONSTRUCTION_FRAMES.delete(frame);
        adjustSecondaryMutation(frame.secondaryOwner,"AUTHENTIC_CONSTRUCTION_FRAMES",-1);
    }
}

/** Authenticates a generated constructor phase without exposing a brand/adopt operation. */
export function enterConstruction(value: object, newTarget: unknown,
    declared: RuntimeConstructor, proof: unknown): void {
    requireSealed();
    if(typeof newTarget==="function")requireUsableSecondaryConstructor(newTarget);
    requireUsableSecondaryConstructor(declared);
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
        if (frame.receiver !== null) PRE_SUPER_RECEIVERS.set(value, frame.receiver);
        if (frame.secondaryOwner) {
            frame.secondaryOwner.preparedConstructions -= 1;
            adjustSecondaryMutation(frame.secondaryOwner,"PREPARED_CONSTRUCTION_FRAMES",-1);
            AUTHENTIC_CONSTRUCTION_FRAMES.delete(frame);
            adjustSecondaryMutation(frame.secondaryOwner,"AUTHENTIC_CONSTRUCTION_FRAMES",-1);
        }
    } else if (target !== declared) {
        throw new TypeError("AS3 constructor entry lacks the target constructor handoff");
    }
    ACTIVE_CONSTRUCTIONS.set(value, target);
    const secondaryOwner = SECONDARY_CONSTRUCTOR_OWNERS.get(target);
    if (secondaryOwner) {
        SECONDARY_INSTANCE_OWNERS.set(value, secondaryOwner);
        secondaryOwner.activeConstructions += 1;
        secondaryOwner.activeInstances.add(value);
        adjustSecondaryMutation(secondaryOwner,"ACTIVE_CONSTRUCTIONS",1);
    }
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
    PRE_SUPER_RECEIVERS.delete(value);
    const secondaryOwner = SECONDARY_INSTANCE_OWNERS.get(value);
    if (secondaryOwner) {
        secondaryOwner.activeConstructions -= 1;
        secondaryOwner.activeInstances.delete(value);
        adjustSecondaryMutation(secondaryOwner,"ACTIVE_CONSTRUCTIONS",-1);
        SECONDARY_INSTANCE_OWNERS.delete(value);
    }
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
    PRE_SUPER_RECEIVERS.delete(value);
    const secondaryOwner = SECONDARY_INSTANCE_OWNERS.get(value);
    if (secondaryOwner) {
        secondaryOwner.activeConstructions -= 1;
        secondaryOwner.activeInstances.delete(value);
        adjustSecondaryMutation(secondaryOwner,"ACTIVE_CONSTRUCTIONS",-1);
        if(!secondaryOwner.initializedInstances.has(value)) SECONDARY_INSTANCE_OWNERS.delete(value);
    }
}

/** Initializes authenticated AS3 slots once, before the first base constructor user statement. */
export function initializeInstanceFields(value: object, newTarget: RuntimeConstructor): void {
    requireSealed();
    requireUsableSecondaryConstructor(newTarget);
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
    const preview = PRE_SUPER_RECEIVERS.get(value);
    if (preview !== undefined) {
        chain.forEach(constructor => CLASS_FIELD_DEFAULTS.get(constructor)?.forEach(field => {
            const descriptor = Object.getOwnPropertyDescriptor(preview, field.name);
            if (descriptor && "value" in descriptor) {
                Object.defineProperty(value, field.name,
                    {value: descriptor.value, writable: true, enumerable: true, configurable: true});
            }
        }));
        PRE_SUPER_FINAL_RECEIVERS.set(preview, value);
    }
    INITIALIZED_INSTANCE_FIELDS.add(value);
    const secondaryOwner = SECONDARY_CONSTRUCTOR_OWNERS.get(newTarget);
    if (secondaryOwner) {
        SECONDARY_INSTANCE_OWNERS.set(value, secondaryOwner);
        secondaryOwner.initializedOrLiveInstances += 1;
        secondaryOwner.initializedInstances.add(value);
        secondaryOwner.state="sealed";
        adjustSecondaryMutation(secondaryOwner,"INITIALIZED_INSTANCE_FIELDS",1);
    }
}

export function registerVectorType<T extends object>(name: string, policy: object,
    predicate: (value: unknown) => boolean): AS3TypeToken<T> {
    rejectPrimaryMutationDuringTransaction("register an AS3 Vector runtime type");
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

function rejectPrimaryMutationDuringTransaction(operation:string):void {
    if(authorityState==="validating") {
        if(activePrimaryValidation)activePrimaryValidation.compromised=true;
        throw new TypeError(`Cannot ${operation} during AS3 primary authority validation`);
    }
    if(authorityState==="reserved"||authorityState==="installing")
        throw new TypeError(`Cannot ${operation} during an AS3 primary authority transaction`);
    if(authorityState==="poisoned")throw new TypeError("AS3 primary runtime type authority is poisoned");
}

/**
 * Snapshot authority input without invoking user getters. Proxy reflection may
 * itself execute traps, so the validation guard is established before this is
 * called and any reentrant registry mutation permanently compromises the run.
 */
function snapshotAuthorityValue(value:unknown,seen=new Set<object>()):unknown {
    if(value===null||typeof value==="string"||typeof value==="number"||typeof value==="boolean"
        ||typeof value==="undefined"||typeof value==="function")return value;
    if(typeof value!=="object")throw new TypeError("AS3 authority contains an unsupported value");
    if(seen.has(value))throw new TypeError("AS3 authority contains a cyclic value");
    seen.add(value);
    try {
        const prototype=Object.getPrototypeOf(value),array=Array.isArray(value);
        if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)
            throw new TypeError("AS3 authority contains a foreign-prototype container");
        const keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
        if(keys.some(key=>typeof key!=="string"))throw new TypeError("AS3 authority contains a symbol key");
        if(array) {
            const lengthDescriptor=descriptors.length;
            if(!lengthDescriptor||!("value" in lengthDescriptor)||!Number.isSafeInteger(lengthDescriptor.value)
                ||lengthDescriptor.value<0||keys.length!==lengthDescriptor.value+1)
                throw new TypeError("AS3 authority contains a sparse or widened array");
            const result:unknown[]=[];
            for(let index=0;index<lengthDescriptor.value;index+=1) {
                const descriptor=descriptors[String(index)];
                if(!descriptor||!("value" in descriptor)||!descriptor.enumerable)
                    throw new TypeError("AS3 authority array contains an accessor or hidden element");
                result.push(snapshotAuthorityValue(descriptor.value,seen));
            }
            return result;
        }
        const result=Object.create(prototype) as Record<string,unknown>;
        for(const key of keys as string[]) {
            const descriptor=descriptors[key];
            if(!descriptor||!("value" in descriptor)||!descriptor.enumerable)
                throw new TypeError("AS3 authority contains an accessor or hidden property");
            Object.defineProperty(result,key,{value:snapshotAuthorityValue(descriptor.value,seen),
                enumerable:true,writable:true,configurable:true});
        }
        return result;
    } finally {seen.delete(value);}
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
                sourceSha256: entry.sourceSha256, fields: entry.fields, ...(entry.objectTraits ? {objectTraits:entry.objectTraits} : {}), ...(entry.nativeObjectTraits ? {nativeObjectTraits:entry.nativeObjectTraits} : {}),
                ...(entry.fileLocalScope ? {fileLocalScope:entry.fileLocalScope} : {}),
                ...(entry.staticReflection !== undefined ? {staticReflection:entry.staticReflection} : {}),
                ...(entry.staticCallTraits !== undefined ? {staticCallTraits:entry.staticCallTraits} : {}) }),
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

function canonicalSecondaryAuthorityMetadata(document:AS3SecondaryTypeAuthorityDocument):string {
    return JSON.stringify({schema:document.schema,primarySha256:document.primarySha256,qnames:document.qnames,
        entries:document.entries.map(entry=>entry.kind==="interface"
            ?{kind:entry.kind,qname:entry.qname,bases:entry.bases}
            :{kind:entry.kind,qname:entry.qname,base:entry.base,interfaces:entry.interfaces,
                sourceSha256:entry.sourceSha256,fields:entry.fields,...(entry.objectTraits?{objectTraits:entry.objectTraits}:{}),
                ...(entry.nativeObjectTraits?{nativeObjectTraits:entry.nativeObjectTraits}:{}),
                ...(entry.fileLocalScope?{fileLocalScope:entry.fileLocalScope}:{}),
                ...(entry.staticReflection!==undefined?{staticReflection:entry.staticReflection}:{}),
                ...(entry.staticCallTraits!==undefined?{staticCallTraits:entry.staticCallTraits}:{})})});
}

function prepareSecondaryPublication(entries:readonly AS3AuthorityEntry[]):readonly SecondaryPublication[] {
    const publications:SecondaryPublication[]=[];
    const localTokens=new Map<string,AS3TypeToken<object>>();
    const localDetails=new WeakMap<object,TypeDetails<object>>();
    const localClasses=new Map<string,RuntimeConstructor>();
    const tokenFor=(name:string):AS3TypeToken<object>=>localTokens.get(name)
        ??CLASS_BY_QNAME.get(name)?.token??INTERFACE_TOKENS.get(name)!;
    const detailsFor=(token:AS3TypeToken<object>):TypeDetails<object>=>localDetails.get(token as object)
        ??requireKind(token,["class","interface"]);
    for(const entry of entries) {
        if(entry.kind==="interface") {
            const closure=new Set<object>();
            entry.bases.forEach(name=>{const base=tokenFor(name);closure.add(base);
                (detailsFor(base).referenceClosure??[]).forEach(item=>closure.add(item));});
            const sealedClosure=Object.freeze(Array.from(closure));
            const token=Object.freeze({name:entry.qname});
            const details:TypeDetails<object>=Object.freeze({kind:"interface",referenceClosure:sealedClosure,
                test:(value:unknown):value is object=>{
                    if((typeof value!=="object"&&typeof value!=="function")||value===null)return false;
                    for(const constructor of REGISTERED_CLASSES) {
                        if(!CLASS_INTERFACES.get(constructor)?.includes(token))continue;
                        if(classValueMatches(value,constructor as RuntimeConstructor))return true;
                    }
                    return false;
                }});
            localTokens.set(entry.qname,token);localDetails.set(token,details);
            publications.push(Object.freeze({kind:"interface",qname:entry.qname,token,details}));
            continue;
        }
        const closure=new Set<object>();
        let base:RuntimeConstructor|null=null;
        if(entry.base!==null) {
            const baseToken=tokenFor(entry.base);base=localClasses.get(entry.base)??CLASS_BY_QNAME.get(entry.base)!.constructor;
            closure.add(baseToken);(detailsFor(baseToken).referenceClosure??[]).forEach(item=>closure.add(item));
            const inherited=localClasses.has(entry.base)
                ?(publications.find(item=>item.kind==="class"&&item.constructor===base) as SecondaryClassPublication).interfaces
                :CLASS_INTERFACES.get(base)??[];
            inherited.forEach(item=>closure.add(item));
        }
        entry.interfaces.forEach(name=>{const token=tokenFor(name);closure.add(token);
            (detailsFor(token).referenceClosure??[]).forEach(item=>closure.add(item));});
        const scopedIdentity=entry.fileLocalScope?fileLocalClassIdentity(entry.fileLocalScope):null;
        if(scopedIdentity!==null&&(scopedIdentity.key!==entry.qname||entry.constructionTarget===null
            ||entry.constructionProof===null||!entry.objectTraits||entry.nativeObjectTraits))
            throw new TypeError("AS3 secondary file-local class identity differs from its generated source scope");
        let staticCalls:StaticCallAuthority|null=null;
        if(entry.staticCallTraits!==undefined) {
            if(entry.constructionTarget===null||entry.constructionProof===null||!entry.objectTraits||entry.nativeObjectTraits)
                throw new TypeError("Secondary static calls require generated source class authority");
            const traits=entry.staticCallTraits;exactKeys(traits,["methods","noncallableNames","unsupportedNames"],
                "AS3 secondary static call traits");
            if(!Array.isArray(traits.methods))throw new TypeError("Invalid secondary static call methods");
            const names=new Set<string>();
            const methods=traits.methods.map(method=>{
                exactKeys(method,["name","visibility","required","total","rest","parameterTypes"],
                    "AS3 secondary static call method");
                if(!stableRuntimeTypeName(method.name)||names.has(method.name)
                    ||!["public","private","protected","internal"].includes(method.visibility)
                    ||!Number.isSafeInteger(method.required)||!Number.isSafeInteger(method.total)||method.required<0
                    ||method.total<method.required||typeof method.rest!=="boolean"||!Array.isArray(method.parameterTypes)
                    ||method.parameterTypes.length!==method.total||method.parameterTypes.some((type:string)=>typeof type!=="string"
                        ||type!=="*"&&!stableRuntimeTypeName(type)))throw new TypeError("Invalid secondary static call method");
                names.add(method.name);const descriptor=Object.getOwnPropertyDescriptor(entry.constructor,method.name);
                if(!descriptor||!("value" in descriptor)||typeof descriptor.value!=="function")
                    throw new TypeError("Secondary static method lacks own generated callable storage");
                return Object.freeze({...method,parameterTypes:Object.freeze([...method.parameterTypes]),callable:descriptor.value});
            });
            for(const list of [traits.noncallableNames,traits.unsupportedNames]) {validateQNameList(list,"AS3 secondary static nonmethod names");
                for(const name of list){if(names.has(name))throw new TypeError("Conflicting secondary static member spelling");names.add(name);}}
            staticCalls=Object.freeze({methods:Object.freeze(methods),noncallableNames:Object.freeze([...traits.noncallableNames]),
                unsupportedNames:Object.freeze([...traits.unsupportedNames])});
        }
        const reflectionName=scopedIdentity?.reflectionName??entry.qname;
        let staticReflection:AS3StaticReflectionDescriptor|null=null;
        if(entry.staticReflection!==undefined) {
            const reflection=entry.staticReflection;exactKeys(reflection,["variables"],"AS3 secondary static reflection traits");
            if(!Array.isArray(reflection.variables))throw new TypeError("Invalid secondary static reflection variables");
            const names=new Set<string>();
            const variables=reflection.variables.map(variable=>{exactKeys(variable,["name","type"],"AS3 secondary static reflection variable");
                if(!stableRuntimeTypeName(variable.name)||!stableRuntimeTypeName(variable.type)||names.has(variable.name))
                    throw new TypeError("Invalid or duplicate secondary static reflection variable");
                names.add(variable.name);return Object.freeze({...variable});});
            const qualifiedName=scopedIdentity?reflectionName:entry.qname.includes(".")
                ?entry.qname.slice(0,entry.qname.lastIndexOf("."))+"::"+entry.qname.slice(entry.qname.lastIndexOf(".")+1):entry.qname;
            staticReflection=Object.freeze({qualifiedName,staticVariables:Object.freeze(variables)});
        }
        let objectTraits:AS3ObjectTraits|null=null;
        if(entry.objectTraits) {
            const traits=entry.objectTraits;exactKeys(traits,["dynamic",...(traits.final===true?["final"]:[]),"members"],
                "AS3 secondary Object traits");
            if(typeof traits.dynamic!=="boolean"||!Array.isArray(traits.members))throw new TypeError("Invalid secondary AS3 Object traits");
            const names=new Set<string>();
            const members=traits.members.map(member=>{exactKeys(member,["name","kind","type","visibility","namespaceName"],
                "AS3 secondary Object member");const key=JSON.stringify([member.name,member.kind,member.visibility,member.namespaceName]);
                if(!stableRuntimeTypeName(member.name)||!stableRuntimeTypeName(member.type)
                    ||!["field","const","method","getter","setter"].includes(member.kind)
                    ||!["public","private","protected","internal","namespace"].includes(member.visibility)
                    ||member.namespaceName!==null&&!stableRuntimeTypeName(member.namespaceName)
                    ||(member.visibility==="namespace")!==(member.namespaceName!==null)||names.has(key))
                    throw new TypeError("Invalid AS3 Object member in publication plan");
                names.add(key);return Object.freeze({...member});});
            objectTraits=Object.freeze({dynamic:traits.dynamic,...(traits.final===true?{final:true as const}:{}),members:Object.freeze(members)});
        }
        let nativeTraits:AS3NativeObjectTraits|null=null;
        if(entry.nativeObjectTraits) {
            const traits=entry.nativeObjectTraits;exactKeys(traits,["dynamic","names","sourceArtifactSha256"],"AS3 secondary native Object census");
            if(entry.objectTraits||(traits.dynamic!==null&&typeof traits.dynamic!=="boolean")||!/^[a-f0-9]{64}$/.test(traits.sourceArtifactSha256))
                throw new TypeError("Invalid secondary AS3 native Object census");
            validateQNameList(traits.names,"AS3 secondary native member names");
            nativeTraits=Object.freeze({...traits,names:Object.freeze([...traits.names])});
        }
        const sealedClosure=Object.freeze(Array.from(closure));
        const token=Object.freeze({name:reflectionName});
        const details:TypeDetails<object>=Object.freeze({kind:"class",referenceClosure:sealedClosure,
            test:(value:unknown):value is object=>classValueMatches(value,entry.constructor)});
        const objectEntry=Object.freeze({qname:entry.qname,reflectionName,
            diagnosticName:scopedIdentity?reflectionName.replace("::","."):entry.qname,
            localName:scopedIdentity?.localName??entry.qname.slice(entry.qname.lastIndexOf(".")+1),
            packageName:scopedIdentity?"":entry.qname.slice(0,Math.max(0,entry.qname.lastIndexOf("."))),
            traits:objectTraits,nativeTraits});
        const publication:SecondaryClassPublication=Object.freeze({kind:"class",qname:entry.qname,
            constructor:entry.constructor,token,details,interfaces:sealedClosure,predicate:entry.predicate,
            constructionTarget:entry.constructionTarget,constructionProof:entry.constructionProof,
            fields:Object.freeze(entry.fields.map(field=>Object.freeze({...field}))),staticCalls,staticReflection,objectEntry,base});
        localTokens.set(entry.qname,token);localDetails.set(token,details);localClasses.set(entry.qname,entry.constructor);
        publications.push(publication);
    }
    return Object.freeze(publications);
}

function preparePrimaryPublication(document:AS3TypeAuthorityDocument):readonly SecondaryPublication[] {
    exactKeys(document as unknown as object,["schema","sha256","qnames","entries"],"AS3 authority");
    if(document.schema!=="as3-runtime-type-authority@1"||!/^[0-9a-f]{64}$/.test(document.sha256))
        throw new TypeError("AS3 authority schema or SHA-256 is invalid");
    validateQNameList(document.qnames,"AS3 authority qnames");
    if(!Array.isArray(document.entries)||document.entries.length!==document.qnames.length)
        throw new TypeError("AS3 authority entry set does not match its exact QName set");
    if(sha256Ascii(canonicalAuthorityMetadata(document))!==document.sha256)
        throw new TypeError("AS3 authority canonical SHA-256 does not match its metadata");
    const plannedKinds=new Map<string,"class"|"interface">(),plannedClasses=new Map<string,AS3ClassAuthorityEntry>();
    const constructors=new Set<Function>();
    for(let index=0;index<document.entries.length;index+=1) {
        const entry=document.entries[index]!;
        if(!entry||typeof entry!=="object"||entry.qname!==document.qnames[index]||!stableRuntimeTypeName(entry.qname)
            ||plannedKinds.has(entry.qname)||INTERFACE_TOKENS.has(entry.qname)||CLASS_BY_QNAME.has(entry.qname)
            ||entry.qname.startsWith("FilePrivate(")&&(entry.kind!=="class"||!entry.fileLocalScope))
            throw new TypeError("AS3 authority has duplicate, drifted, or out-of-order QName identity");
        const kind=(name:string):"class"|"interface"|null=>plannedKinds.get(name)??null;
        if(entry.kind==="interface") {
            exactKeys(entry as unknown as object,["kind","qname","bases"],`AS3 interface ${entry.qname}`);
            validateQNameList(entry.bases,`AS3 interface ${entry.qname} bases`);
            if(entry.bases.some((name:string)=>kind(name)!=="interface"))
                throw new TypeError(`AS3 interface ${entry.qname} has a missing, cyclic, or out-of-order base`);
            plannedKinds.set(entry.qname,"interface");continue;
        }
        if(entry.kind!=="class")throw new TypeError("AS3 authority contains an unknown entry kind");
        exactKeys(entry as unknown as object,["kind","qname","base","interfaces","sourceSha256","fields",
            ...(entry.objectTraits?["objectTraits"]:[]),...(entry.nativeObjectTraits?["nativeObjectTraits"]:[]),
            ...(entry.fileLocalScope?["fileLocalScope"]:[]),...(entry.staticReflection!==undefined?["staticReflection"]:[]),
            ...(entry.staticCallTraits!==undefined?["staticCallTraits"]:[]),"constructor","predicate","constructionTarget",
            "constructionProof"],`AS3 class ${entry.qname}`);
        if(entry.base!==null&&kind(entry.base)!=="class")
            throw new TypeError(`AS3 class ${entry.qname} has a missing, cyclic, or out-of-order class base`);
        const baseEntry=entry.base===null?null:plannedClasses.get(entry.base);
        if(baseEntry?.objectTraits?.final)throw new TypeError(`AS3 class ${entry.qname} cannot extend final class ${entry.base}`);
        validateQNameList(entry.interfaces,`AS3 class ${entry.qname} interfaces`);
        if(entry.interfaces.some((name:string)=>kind(name)!=="interface"))
            throw new TypeError(`AS3 class ${entry.qname} has a missing or out-of-order interface`);
        const localConstruction=typeof entry.constructionTarget==="function"&&typeof entry.constructionProof==="function";
        const mappedConstruction=entry.constructionTarget===null&&entry.constructionProof===null;
        if(!/^[0-9a-f]{64}$/.test(entry.sourceSha256)||typeof entry.constructor!=="function"
            ||typeof entry.predicate!=="function"||constructors.has(entry.constructor)||CLASS_TOKENS.has(entry.constructor)
            ||!Array.isArray(entry.fields)||entry.fields.some((field:AS3ClassAuthorityEntry["fields"][number])=>!field||typeof field!=="object"
                ||Object.keys(field).join("\0")!=="name\0policy"||!stableRuntimeTypeName(field.name)
                ||!["zero","nan","false","null","undefined"].includes(field.policy))
            ||new Set(entry.fields.map((field:AS3ClassAuthorityEntry["fields"][number])=>field.name)).size!==entry.fields.length||!localConstruction&&!mappedConstruction)
            throw new TypeError(`AS3 class ${entry.qname} identity is invalid or reused`);
        if(entry.fileLocalScope&&fileLocalClassIdentity(entry.fileLocalScope).key!==entry.qname)
            throw new TypeError("AS3 file-local class identity differs from its source scope");
        constructors.add(entry.constructor);plannedKinds.set(entry.qname,"class");plannedClasses.set(entry.qname,entry);
    }
    return prepareSecondaryPublication(document.entries);
}

function requirePrimaryOwner(reservation:AS3PrimaryTypeAuthorityReservation):PrimaryOwner {
    if((typeof reservation!=="object"&&typeof reservation!=="function")||reservation===null
        ||!AUTHENTIC_PRIMARY_RESERVATIONS.has(reservation as object))
        throw new TypeError("AS3 primary authority reservation is not an owned identity");
    const owner=PRIMARY_RESERVATION_OWNERS.get(reservation as object);
    if(!owner||activePrimaryOwner!==owner||owner.reservation!==reservation)
        throw new TypeError("AS3 primary authority reservation ownership differs");
    return owner;
}

/**
 * Validates and privately materializes the complete primary publication plan.
 * It does not mutate registry identity. Constructing the document may already
 * have evaluated class modules; that evaluation and later class initializers
 * are outside this transaction and are never described as rollbackable.
 */
export function preflightAS3TypeAuthority(document:AS3TypeAuthorityDocument):AS3PrimaryTypeAuthorityReservation {
    if(authorityState!=="open"||activePrimaryOwner!==null) {
        if(authorityState==="validating"&&activePrimaryValidation)activePrimaryValidation.compromised=true;
        throw new TypeError("AS3 type authority is already installing or sealed");
    }
    const guard:PrimaryValidationGuard={compromised:false};
    activePrimaryValidation=guard;authorityState="validating";
    try {
        const snapshot=snapshotAuthorityValue(document) as AS3TypeAuthorityDocument;
        const plan=preparePrimaryPublication(snapshot);
        const reservation=Object.freeze({__proto__:null,schema:"as3-primary-type-authority-reservation@1" as const,
            typeAuthoritySha256:snapshot.sha256,qnames:Object.freeze([...snapshot.qnames])}) as AS3PrimaryTypeAuthorityReservation;
        const receipt=Object.freeze({__proto__:null,schema:"as3-type-authority-commit-receipt@1" as const,
            typeAuthoritySha256:snapshot.sha256}) as AS3TypeAuthorityCommitReceipt;
        const qnameEntries=new Map<RuntimeConstructor,Readonly<{constructor:RuntimeConstructor;token:AS3TypeToken<object>}>>();
        for(const item of plan)if(item.kind==="class")qnameEntries.set(item.constructor,
            Object.freeze({constructor:item.constructor,token:item.token}));
        if(guard.compromised||activePrimaryValidation!==guard||authorityState!=="validating")
            throw new TypeError("AS3 primary authority validation was reentered or compromised");
        const owner:PrimaryOwner={reservation,receipt,plan,qnameEntries,journal:[],state:"reserved"};
        AUTHENTIC_PRIMARY_RESERVATIONS.add(reservation as object);PRIMARY_RESERVATION_OWNERS.set(reservation as object,owner);
        activePrimaryOwner=owner;activePrimaryValidation=null;authorityState="reserved";return reservation;
    } catch(error) {
        if(activePrimaryValidation===guard)activePrimaryValidation=null;
        if(guard.compromised||authorityState!=="validating")authorityState="poisoned";
        else authorityState="open";
        throw error;
    }
}

/** Releases a validated plan before publication. */
export function abortAS3TypeAuthority(reservation:AS3PrimaryTypeAuthorityReservation):void {
    const owner=requirePrimaryOwner(reservation);
    if(owner.state!=="reserved"||authorityState!=="reserved"||owner.journal.length!==0)
        throw new TypeError("AS3 primary authority reservation cannot abort after commit begins");
    owner.state="aborted";AUTHENTIC_PRIMARY_RESERVATIONS.delete(reservation as object);
    PRIMARY_RESERVATION_OWNERS.delete(reservation as object);activePrimaryOwner=null;authorityState="open";
}

function publishPrimaryMutation(owner:PrimaryOwner,apply:()=>void,undo:()=>void):void {
    const mutation:PrimaryMutation={applied:false,undo};owner.journal.push(mutation);
    mutation.applied=true;apply();
}
function publishPrimaryWeakSet(owner:PrimaryOwner,set:WeakSet<object>,key:object):void {
    publishPrimaryMutation(owner,()=>set.add(key),()=>{if(set.has(key)&&!set.delete(key))
        throw new TypeError("Primary WeakSet ownership drifted");});
}
function publishPrimaryWeakMap<K extends object,V>(owner:PrimaryOwner,map:WeakMap<K,V>,key:K,value:V):void {
    publishPrimaryMutation(owner,()=>map.set(key,value),()=>{const current=map.get(key);if(current===value) {
        if(!map.delete(key))throw new TypeError("Primary WeakMap ownership drifted");
    } else if(current!==undefined)throw new TypeError("Primary WeakMap ownership drifted");});
}
function publishPrimaryMap<K,V>(owner:PrimaryOwner,map:Map<K,V>,key:K,value:V):void {
    publishPrimaryMutation(owner,()=>map.set(key,value),()=>{const current=map.get(key);if(current===value) {
        if(!map.delete(key))throw new TypeError("Primary Map ownership drifted");
    } else if(current!==undefined||map.has(key))throw new TypeError("Primary Map ownership drifted");});
}
function undoPrimaryJournal(owner:PrimaryOwner):void {while(owner.journal.length!==0) {
    const mutation=owner.journal.pop()!;if(mutation.applied)mutation.undo();
}}

/** Atomically publishes a fully preflighted primary plan and returns its nominal receipt. */
export function commitAS3TypeAuthority(reservation:AS3PrimaryTypeAuthorityReservation):AS3TypeAuthorityCommitReceipt {
    const owner=requirePrimaryOwner(reservation);
    if(owner.state!=="reserved"||authorityState!=="reserved"||owner.journal.length!==0)
        throw new TypeError("AS3 primary authority reservation is not commit-ready");
    owner.state="installing";authorityState="installing";
    try {
        for(const item of owner.plan) {
            publishPrimaryWeakSet(owner,TYPE_TOKENS,item.token);
            publishPrimaryWeakMap(owner,TYPE_DETAILS,item.token,item.details);
            if(item.kind==="interface") {publishPrimaryMap(owner,INTERFACE_TOKENS,item.qname,item.token);continue;}
            const constructor=item.constructor;
            publishPrimaryWeakMap(owner,CLASS_TOKENS,constructor,item.token);
            publishPrimaryMap(owner,CLASS_BY_QNAME,item.qname,owner.qnameEntries.get(constructor)!);
            publishPrimaryWeakMap(owner,CLASS_INTERFACES,constructor,item.interfaces);
            publishPrimaryWeakMap(owner,CLASS_PREDICATES,constructor,item.predicate);
            if(item.constructionTarget)publishPrimaryWeakMap(owner,CLASS_CONSTRUCTION_TARGETS,constructor,item.constructionTarget);
            if(item.constructionProof)publishPrimaryWeakMap(owner,CLASS_CONSTRUCTION_PROOFS,constructor,item.constructionProof);
            publishPrimaryWeakMap(owner,CLASS_FIELD_DEFAULTS,constructor,item.fields);
            if(item.staticCalls)publishPrimaryWeakMap(owner,STATIC_CALLS,constructor,item.staticCalls);
            if(item.staticReflection)publishPrimaryWeakMap(owner,STATIC_REFLECTION,constructor,item.staticReflection);
            publishPrimaryWeakMap(owner,CLASS_OBJECT_ENTRIES,constructor,item.objectEntry);
            publishPrimaryWeakMap(owner,CLASS_BASES,constructor,item.base);
            publishPrimaryMutation(owner,()=>REGISTERED_CLASSES.push(constructor),()=>{
                if(REGISTERED_CLASSES[REGISTERED_CLASSES.length-1]===constructor)REGISTERED_CLASSES.pop();
                else if(REGISTERED_CLASSES.includes(constructor))throw new TypeError("Primary class order drifted");});
        }
        publishPrimaryWeakSet(owner,AUTHENTIC_PRIMARY_RECEIPTS,owner.receipt as object);
        installedAuthoritySha256=reservation.typeAuthoritySha256;
        owner.state="committed";authorityState="sealed";return owner.receipt;
    } catch(error) {
        try {undoPrimaryJournal(owner);} catch(rollbackError) {owner.state="poisoned";authorityState="poisoned";throw rollbackError;}
        owner.state="poisoned";authorityState="poisoned";installedAuthoritySha256=null;throw error;
    }
}

/** Owner-side terminal poison remains usable when receipt delivery or validation is ambiguous. */
export function poisonAS3TypeAuthority(reservation:AS3PrimaryTypeAuthorityReservation):void {
    const owner=requirePrimaryOwner(reservation);
    if(owner.state!=="reserved"&&owner.state!=="committed")
        throw new TypeError("AS3 primary authority cannot poison in this state");
    if(owner.state==="committed")AUTHENTIC_PRIMARY_RECEIPTS.delete(owner.receipt as object);
    owner.state="poisoned";authorityState="poisoned";
}

export function isAS3TypeAuthorityCommitReceipt(value:unknown):value is AS3TypeAuthorityCommitReceipt {
    return (typeof value==="object"||typeof value==="function")&&value!==null
        &&AUTHENTIC_PRIMARY_RECEIPTS.has(value as object);
}

export function primaryAuthorityTransactionStatus():Readonly<{phase:"open"|"validating"|"reserved"|"installing"|"sealed"|"poisoned";
    typeAuthoritySha256:string|null;publishedMutations:number}> {
    return Object.freeze({phase:authorityState,typeAuthoritySha256:activePrimaryOwner?.reservation.typeAuthoritySha256
        ??installedAuthoritySha256,publishedMutations:activePrimaryOwner?.journal.length??0});
}

/**
 * Package-internal fail-closed reservation only. This authenticates and closes a
 * secondary extension plan without publishing tokens, constructors, traits, or
 * predicates. A later transactional committer must consume this exact branded
 * reservation; callers cannot turn it into registry authority themselves.
 */
export function preflightAS3SecondaryTypeAuthority(document:AS3SecondaryTypeAuthorityDocument):
    AS3SecondaryTypeAuthorityReservation {
    requireSealed();
    if(activeSecondaryReservation!==null) throw new TypeError("An AS3 secondary authority reservation is already active");
    exactKeys(document as unknown as object,["schema","primarySha256","sha256","qnames","entries"],"AS3 secondary authority");
    if(document.schema!=="as3-runtime-secondary-type-authority@1"||document.primarySha256!==installedAuthoritySha256
        ||!/^[0-9a-f]{64}$/.test(document.sha256)||sha256Ascii(canonicalSecondaryAuthorityMetadata(document))!==document.sha256)
        throw new TypeError("AS3 secondary authority primary identity or canonical SHA-256 differs");
    validateQNameList(document.qnames,"AS3 secondary authority qnames");
    if(!Array.isArray(document.entries)||document.entries.length!==document.qnames.length)
        throw new TypeError("AS3 secondary authority entry set does not match its exact QName set");
    const plannedKinds=new Map<string,"class"|"interface">(),plannedClasses=new Map<string,AS3ClassAuthorityEntry>();
    const constructors=new Set<Function>();
    for(let index=0;index<document.entries.length;index+=1) {
        const entry=document.entries[index]!;
        if(!entry||typeof entry!=="object"||entry.qname!==document.qnames[index]||!stableRuntimeTypeName(entry.qname)
            ||plannedKinds.has(entry.qname)||INTERFACE_TOKENS.has(entry.qname)||CLASS_BY_QNAME.has(entry.qname))
            throw new TypeError("AS3 secondary authority has a collision, drift, or out-of-order QName");
        const kind=(name:string):"class"|"interface"|null=>plannedKinds.get(name)
            ??(CLASS_BY_QNAME.has(name)?"class":INTERFACE_TOKENS.has(name)?"interface":null);
        if(entry.kind==="interface") {
            exactKeys(entry as unknown as object,["kind","qname","bases"],`AS3 secondary interface ${entry.qname}`);
            validateQNameList(entry.bases,`AS3 secondary interface ${entry.qname} bases`);
            if(entry.bases.some((name:string)=>kind(name)!=="interface"))
                throw new TypeError(`AS3 secondary interface ${entry.qname} has a missing, cyclic, or wrong-kind base`);
            plannedKinds.set(entry.qname,"interface");
            continue;
        }
        if(entry.kind!=="class") throw new TypeError("AS3 secondary authority contains an unknown entry kind");
        exactKeys(entry as unknown as object,["kind","qname","base","interfaces","sourceSha256","fields",
            ...(entry.objectTraits?["objectTraits"]:[]),...(entry.nativeObjectTraits?["nativeObjectTraits"]:[]),
            ...(entry.fileLocalScope?["fileLocalScope"]:[]),...(entry.staticReflection!==undefined?["staticReflection"]:[]),
            ...(entry.staticCallTraits!==undefined?["staticCallTraits"]:[]),"constructor","predicate","constructionTarget","constructionProof"],
        `AS3 secondary class ${entry.qname}`);
        if(entry.base!==null&&kind(entry.base)!=="class")
            throw new TypeError(`AS3 secondary class ${entry.qname} has a missing, cyclic, or wrong-kind base`);
        const baseEntry=entry.base===null?null:plannedClasses.get(entry.base);
        const primaryBase=entry.base===null?null:CLASS_BY_QNAME.get(entry.base)?.constructor;
        if(baseEntry?.objectTraits?.final||primaryBase&&CLASS_OBJECT_ENTRIES.get(primaryBase)?.traits?.final)
            throw new TypeError(`AS3 secondary class ${entry.qname} cannot extend final class ${entry.base}`);
        validateQNameList(entry.interfaces,`AS3 secondary class ${entry.qname} interfaces`);
        if(entry.interfaces.some((name:string)=>kind(name)!=="interface"))
            throw new TypeError(`AS3 secondary class ${entry.qname} has a missing or wrong-kind interface`);
        const localConstruction=typeof entry.constructionTarget==="function"&&typeof entry.constructionProof==="function";
        const mappedConstruction=entry.constructionTarget===null&&entry.constructionProof===null;
        if(!/^[0-9a-f]{64}$/.test(entry.sourceSha256)||typeof entry.constructor!=="function"
            ||typeof entry.predicate!=="function"||constructors.has(entry.constructor)||CLASS_TOKENS.has(entry.constructor)
            ||REVOKED_SECONDARY_CONSTRUCTORS.has(entry.constructor)
            ||!Array.isArray(entry.fields)||entry.fields.some((field:AS3ClassAuthorityEntry["fields"][number])=>!field||typeof field!=="object"
                ||Object.keys(field).join("\0")!=="name\0policy"||!stableRuntimeTypeName(field.name)
                ||!["zero","nan","false","null","undefined"].includes(field.policy))
            ||new Set(entry.fields.map((field:AS3ClassAuthorityEntry["fields"][number])=>field.name)).size!==entry.fields.length||!localConstruction&&!mappedConstruction)
            throw new TypeError(`AS3 secondary class ${entry.qname} identity is invalid or reused`);
        if(entry.fileLocalScope&&fileLocalClassIdentity(entry.fileLocalScope).key!==entry.qname)
            throw new TypeError("AS3 secondary file-local class identity differs from its source scope");
        constructors.add(entry.constructor);plannedKinds.set(entry.qname,"class");plannedClasses.set(entry.qname,entry);
    }
    const plan=prepareSecondaryPublication(document.entries);
    const reservation=Object.freeze({primarySha256:document.primarySha256,sha256:document.sha256,
        qnames:Object.freeze([...document.qnames])});
    const mutations=Object.create(null) as Record<AS3SecondaryMutationSurface,number>;
    SECONDARY_MUTATION_SURFACES.forEach(surface=>{mutations[surface]=0;});
    const owner:SecondaryOwner={reservation,plan,mutations,journal:[],constructors:new Set(),activeInstances:new Set(),
        initializedInstances:new Set(),lease:null,state:"reserved",preparedConstructions:0,activeConstructions:0,
        initializedOrLiveInstances:0};
    AUTHENTIC_SECONDARY_RESERVATIONS.add(reservation);
    SECONDARY_RESERVATION_OWNERS.set(reservation,owner);
    activeSecondaryReservation=reservation;
    return reservation;
}

function requireActiveSecondaryOwner(reservation:AS3SecondaryTypeAuthorityReservation):SecondaryOwner {
    if((typeof reservation!=="object"&&typeof reservation!=="function")||reservation===null
        ||!AUTHENTIC_SECONDARY_RESERVATIONS.has(reservation as object)||activeSecondaryReservation!==reservation)
        throw new TypeError("AS3 secondary authority reservation is not the active owned identity");
    const owner=SECONDARY_RESERVATION_OWNERS.get(reservation as object);
    if(!owner||owner.reservation!==reservation)
        throw new TypeError("AS3 secondary authority ownership state is inconsistent");
    return owner;
}

function secondaryOwnerHasPublishedState(owner:SecondaryOwner):boolean {
    return SECONDARY_MUTATION_SURFACES.some(surface=>owner.mutations[surface]!==0)
        ||owner.preparedConstructions!==0||owner.activeConstructions!==0||owner.initializedOrLiveInstances!==0;
}

/** Releases an unused preflight reservation. No registry identity was published. */
export function abortAS3SecondaryTypeAuthority(reservation:AS3SecondaryTypeAuthorityReservation):void {
    requireSealed();
    const owner=requireActiveSecondaryOwner(reservation);
    if(owner.state!=="reserved"||secondaryOwnerHasPublishedState(owner))
        throw new TypeError("AS3 secondary authority reservation cannot abort while owned registry or construction state remains");
    AUTHENTIC_SECONDARY_RESERVATIONS.delete(reservation as object);
    SECONDARY_RESERVATION_OWNERS.delete(reservation as object);
    activeSecondaryReservation=null;
}

export function secondaryAuthorityReservationStatus():Readonly<{active:boolean;primarySha256:string|null;sha256:string|null}> {
    return Object.freeze({active:activeSecondaryReservation!==null,
        primarySha256:activeSecondaryReservation?.primarySha256??null,sha256:activeSecondaryReservation?.sha256??null});
}

export interface AS3SecondaryAuthorityOwnershipStatus {
    readonly active:boolean;
    readonly primarySha256:string|null;
    readonly sha256:string|null;
    readonly phase:"none"|"reserved"|"committed"|"sealed"|"poisoned"|"revoked";
    readonly commitReady:boolean;
    readonly rollbackable:boolean;
    readonly blockers:readonly string[];
    readonly unownedSurfaces:readonly AS3SecondaryMutationSurface[];
    readonly surfaces:readonly Readonly<{surface:AS3SecondaryMutationSurface;mutationCount:number;
        ownerSha256:string|null}>[];
    readonly constructions:Readonly<{prepared:number;active:number;initializedOrLive:number}>;
}

/**
 * Mechanically enumerates every mutable surface the transactional secondary
 * committer journals. Counts can only belong to the exact active
 * reservation. Construction liveness is deliberately conservative: an
 * initialized secondary instance remains live until a future lease-specific
 * disposal protocol can prove otherwise.
 */
export function secondaryAuthorityOwnershipStatus():AS3SecondaryAuthorityOwnershipStatus {
    requireSealed();
    const owner=activeSecondaryReservation===null?null:requireActiveSecondaryOwner(activeSecondaryReservation);
    const blockers=owner===null?[]:owner.state==="sealed"?["secondary-application-lifetime-sealed"]
        :owner.state==="poisoned"?["secondary-class-initialization-poisoned"]
        :owner.preparedConstructions!==0?["secondary-prepared-construction-active"]
        :owner.activeConstructions!==0?["secondary-construction-active"]
        :owner.initializedOrLiveInstances!==0?["secondary-initialized-instance-live"]:[];
    return Object.freeze({active:owner!==null,primarySha256:owner?.reservation.primarySha256??null,
        sha256:owner?.reservation.sha256??null,phase:owner?.state??"none",commitReady:owner?.state==="reserved",
        rollbackable:owner?.state==="committed"&&blockers.length===0,blockers:Object.freeze(blockers),
        unownedSurfaces:Object.freeze([]),
        surfaces:Object.freeze(SECONDARY_MUTATION_SURFACES.map(surface=>Object.freeze({surface,
            mutationCount:owner?.mutations[surface]??0,
            ownerSha256:owner&&owner.mutations[surface]!==0?owner.reservation.sha256:null}))),
        constructions:Object.freeze({prepared:owner?.preparedConstructions??0,active:owner?.activeConstructions??0,
            initializedOrLive:owner?.initializedOrLiveInstances??0})});
}

function publishSecondaryMutation(owner:SecondaryOwner,surface:AS3SecondaryMutationSurface,
    apply:()=>void,undo:()=>void):void {
    apply();owner.journal.push(Object.freeze({surface,undo}));adjustSecondaryMutation(owner,surface,1);
}

function undoSecondaryJournal(owner:SecondaryOwner):void {
    while(owner.journal.length!==0) {
        const mutation=owner.journal.pop()!;mutation.undo();adjustSecondaryMutation(owner,mutation.surface,-1);
    }
}

function publishSecondaryWeakSet(owner:SecondaryOwner,surface:AS3SecondaryMutationSurface,set:WeakSet<object>,key:object):void {
    publishSecondaryMutation(owner,surface,()=>set.add(key),()=>{if(!set.delete(key))throw new TypeError("Secondary WeakSet ownership drifted");});
}
function publishSecondaryWeakMap<K extends object,V>(owner:SecondaryOwner,surface:AS3SecondaryMutationSurface,
    map:WeakMap<K,V>,key:K,value:V):void {
    publishSecondaryMutation(owner,surface,()=>map.set(key,value),()=>{
        if(map.get(key)!==value||!map.delete(key))throw new TypeError("Secondary WeakMap ownership drifted");});
}
function publishSecondaryMap<K,V>(owner:SecondaryOwner,surface:AS3SecondaryMutationSurface,
    map:Map<K,V>,key:K,value:V):void {
    publishSecondaryMutation(owner,surface,()=>map.set(key,value),()=>{
        if(map.get(key)!==value||!map.delete(key))throw new TypeError("Secondary Map ownership drifted");});
}

/** Atomically publishes the fully precomputed plan and returns its exact rollback lease. */
export function commitAS3SecondaryTypeAuthority(reservation:AS3SecondaryTypeAuthorityReservation):AS3SecondaryTypeAuthorityLease {
    requireSealed();
    const owner=requireActiveSecondaryOwner(reservation);
    if(owner.state!=="reserved"||secondaryOwnerHasPublishedState(owner))
        throw new TypeError("AS3 secondary authority commit found pre-existing owned state");
    try {
        for(const item of owner.plan) {
            publishSecondaryWeakSet(owner,"TYPE_TOKENS",TYPE_TOKENS,item.token);
            publishSecondaryWeakMap(owner,"TYPE_DETAILS",TYPE_DETAILS,item.token,item.details);
            SECONDARY_TOKEN_OWNERS.set(item.token,owner);
            if(item.kind==="interface") {
                publishSecondaryMap(owner,"INTERFACE_TOKENS",INTERFACE_TOKENS,item.qname,item.token);
                continue;
            }
            const constructor=item.constructor;
            publishSecondaryWeakMap(owner,"CLASS_TOKENS",CLASS_TOKENS,constructor,item.token);
            const byQName=Object.freeze({constructor,token:item.token});
            publishSecondaryMap(owner,"CLASS_BY_QNAME",CLASS_BY_QNAME,item.qname,byQName);
            publishSecondaryWeakMap(owner,"CLASS_INTERFACES",CLASS_INTERFACES,constructor,item.interfaces);
            publishSecondaryWeakMap(owner,"CLASS_PREDICATES",CLASS_PREDICATES,constructor,item.predicate);
            if(item.constructionTarget)publishSecondaryWeakMap(owner,"CLASS_CONSTRUCTION_TARGETS",CLASS_CONSTRUCTION_TARGETS,
                constructor,item.constructionTarget);
            if(item.constructionProof)publishSecondaryWeakMap(owner,"CLASS_CONSTRUCTION_PROOFS",CLASS_CONSTRUCTION_PROOFS,
                constructor,item.constructionProof);
            publishSecondaryWeakMap(owner,"CLASS_FIELD_DEFAULTS",CLASS_FIELD_DEFAULTS,constructor,item.fields);
            if(item.staticCalls)publishSecondaryWeakMap(owner,"STATIC_CALLS",STATIC_CALLS,constructor,item.staticCalls);
            if(item.staticReflection)publishSecondaryWeakMap(owner,"STATIC_REFLECTION",STATIC_REFLECTION,constructor,item.staticReflection);
            publishSecondaryWeakMap(owner,"CLASS_OBJECT_ENTRIES",CLASS_OBJECT_ENTRIES,constructor,item.objectEntry);
            publishSecondaryWeakMap(owner,"CLASS_BASES",CLASS_BASES,constructor,item.base);
            publishSecondaryMutation(owner,"REGISTERED_CLASSES",()=>REGISTERED_CLASSES.push(constructor),()=>{
                if(REGISTERED_CLASSES[REGISTERED_CLASSES.length-1]!==constructor)throw new TypeError("Secondary class order drifted");
                REGISTERED_CLASSES.pop();});
            owner.constructors.add(constructor);SECONDARY_CONSTRUCTOR_OWNERS.set(constructor,owner);
        }
    } catch(error) {
        try {undoSecondaryJournal(owner);} catch(rollbackError) {owner.state="poisoned";throw rollbackError;}
        owner.constructors.forEach(constructor=>SECONDARY_CONSTRUCTOR_OWNERS.delete(constructor));owner.constructors.clear();
        owner.plan.forEach(item=>SECONDARY_TOKEN_OWNERS.delete(item.token));
        throw error;
    }
    const lease=Object.freeze({primarySha256:reservation.primarySha256,sha256:reservation.sha256,qnames:reservation.qnames});
    owner.lease=lease;owner.state="committed";AUTHENTIC_SECONDARY_LEASES.add(lease);
    return lease;
}

function requireActiveSecondaryLease(lease:AS3SecondaryTypeAuthorityLease):SecondaryOwner {
    if((typeof lease!=="object"&&typeof lease!=="function")||lease===null||!AUTHENTIC_SECONDARY_LEASES.has(lease as object)
        ||activeSecondaryReservation===null)throw new TypeError("AS3 secondary authority lease is not the active owned identity");
    const owner=requireActiveSecondaryOwner(activeSecondaryReservation);
    if(owner.lease!==lease)throw new TypeError("AS3 secondary authority lease changed ownership identity");
    return owner;
}

/** Permanently retains the extension before arbitrary application initialization or side effects. */
export function sealAS3SecondaryTypeAuthority(lease:AS3SecondaryTypeAuthorityLease):void {
    requireSealed();
    const owner=requireActiveSecondaryLease(lease);
    if(owner.state!=="committed"&&owner.state!=="sealed")throw new TypeError("AS3 secondary authority cannot seal in this state");
    owner.state="sealed";
}

/** Records an irreversible failed application initialization without removing registry identity. */
export function poisonAS3SecondaryTypeAuthority(lease:AS3SecondaryTypeAuthorityLease):void {
    requireSealed();const owner=requireActiveSecondaryLease(lease);
    if(owner.state!=="committed"&&owner.state!=="sealed")throw new TypeError("AS3 secondary authority cannot poison in this state");
    owner.state="poisoned";
}

/** Revokes every journal-owned registry mapping while preserving the sealed primary authority. */
export function rollbackAS3SecondaryTypeAuthority(lease:AS3SecondaryTypeAuthorityLease):void {
    requireSealed();const owner=requireActiveSecondaryLease(lease);
    if(owner.state==="sealed"||owner.initializedOrLiveInstances!==0)
        throw new TypeError("AS3 secondary authority rollback rejected after application-lifetime initialization seal");
    if(owner.state==="poisoned")throw new TypeError("AS3 secondary authority rollback rejected after initialization poison");
    if(owner.state!=="committed")throw new TypeError("AS3 secondary authority lease is not committed");
    if(owner.preparedConstructions!==0||owner.activeConstructions!==0)
        throw new TypeError("AS3 secondary authority rollback rejected during prepared or active construction");
    try {undoSecondaryJournal(owner);} catch(error) {owner.state="poisoned";throw error;}
    owner.plan.forEach(item=>SECONDARY_TOKEN_OWNERS.delete(item.token));
    owner.constructors.forEach(constructor=>{SECONDARY_CONSTRUCTOR_OWNERS.delete(constructor);
        REVOKED_SECONDARY_CONSTRUCTORS.add(constructor);});
    owner.constructors.clear();owner.state="revoked";AUTHENTIC_SECONDARY_LEASES.delete(lease as object);
    AUTHENTIC_SECONDARY_RESERVATIONS.delete(owner.reservation as object);
    SECONDARY_RESERVATION_OWNERS.delete(owner.reservation as object);activeSecondaryReservation=null;
}

/** Package-internal: the package export map intentionally does not expose this module. */
export function installAS3TypeAuthority(document: AS3TypeAuthorityDocument): void {
    let reservation:AS3PrimaryTypeAuthorityReservation|null=null;
    try {
        reservation=preflightAS3TypeAuthority(document);
        commitAS3TypeAuthority(reservation);
        return;
    } catch(error) {
        if(reservation!==null&&authorityState!=="poisoned")poisonAS3TypeAuthority(reservation);
        else if(reservation===null&&authorityState==="open")authorityState="poisoned";
        throw error;
    }
}

export function authorityStatus(): Readonly<{ sealed: boolean; sha256: string | null }> {
    return Object.freeze({ sealed: authorityState === "sealed", sha256: installedAuthoritySha256 });
}

/** Resolve only registered allocation identities; never infer traits from JS fields. */
export function lookupObjectClass(value: unknown): Readonly<{qname:string; reflectionName:string;
    diagnosticName:string; localName:string; constructor:RuntimeConstructor;
    chain:readonly Readonly<ClassObjectEntry>[]}> | null {
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
    return Object.freeze({qname:chain[0]!.qname, reflectionName:chain[0]!.reflectionName,
        diagnosticName:chain[0]!.diagnosticName, localName:chain[0]!.localName,
        constructor:selected, chain:Object.freeze(chain)});
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

export function lookupObjectCallerPackage(qname: string): string {
    lookupObjectCaller(qname);
    return CLASS_OBJECT_ENTRIES.get(CLASS_BY_QNAME.get(qname)!.constructor)!.packageName;
}

/** Class string labels come only from builtin or authenticated runtime identity. */
export function lookupStringClassName(value:unknown):string | null {
    if(authorityState==="poisoned")throw new TypeError("AS3 primary runtime type authority is poisoned");
    if (typeof value === "function") {
        const builtin = [Object,Array,Number,Boolean,String,Function].find(item => item === value);
        if (builtin) return builtin.name;
        requireSealed();
        return CLASS_OBJECT_ENTRIES.get(value)?.reflectionName ?? null;
    }
    if (value !== null && typeof value === "object" && TYPE_TOKENS.has(value))
        return (value as AS3TypeToken<unknown>).name;
    return null;
}

/** Authenticate deferred class initialization after the complete type authority seals. */
export function classInitializationBase(constructor: unknown, proof: unknown): RuntimeConstructor | null {
    requireSealed();
    if(typeof constructor==="function")requireUsableSecondaryConstructor(constructor);
    if (typeof constructor !== "function" || !CLASS_TOKENS.has(constructor) || !validConstructionProof(constructor as RuntimeConstructor, proof))
        throw new TypeError("AS3 class initialization lacks sealed construction authority");
    const secondaryOwner=SECONDARY_CONSTRUCTOR_OWNERS.get(constructor);
    if(secondaryOwner&&secondaryOwner.state==="committed")secondaryOwner.state="sealed";
    return CLASS_BASES.get(constructor) ?? null;
}


/** Read-only dynamic construction lookup; never adopts host constructors. */
export function lookupDynamicConstruction(value:unknown):RuntimeConstructor | string | null {
    requireSealed();
    if (typeof value === "function" && CLASS_TOKENS.has(value)) {requireUsableSecondaryConstructor(value);return value as RuntimeConstructor;}
    if (value !== null && typeof value === "object" && TYPE_DETAILS.get(value)?.kind === "interface")
        return (value as AS3TypeToken<unknown>).name;
    return null;
}

/** Authenticated class identity only; no predicate, constructor or getter is invoked. */
export function getAS3StaticReflectionDescriptor(value: unknown): AS3StaticReflectionDescriptor {
    requireSealed();
    const descriptor = typeof value === "function" && CLASS_TOKENS.has(value) ? STATIC_REFLECTION.get(value) : undefined;
    if (!descriptor) throw new TypeError("AS3 class has no sealed static reflection authority");
    return descriptor;
}

/** Exact constructor identity and own static traits only; never inherit JS constructor properties. */
export function lookupStaticCallClass(value:unknown) {
    requireSealed();
    if (typeof value!=="function" || !CLASS_TOKENS.has(value)) return null;
    const owner=CLASS_OBJECT_ENTRIES.get(value)!;
    return Object.freeze({qname:owner.qname,packageName:owner.packageName,
        diagnosticName:owner.diagnosticName,traits:STATIC_CALLS.get(value) ?? null});
}

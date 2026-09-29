import {
    abortAS3SecondaryTypeAuthority,
    authorityStatus,
    commitAS3SecondaryTypeAuthority,
    lookupClassType,
    poisonAS3SecondaryTypeAuthority,
    preflightAS3SecondaryTypeAuthority,
    sealAS3SecondaryTypeAuthority,
    type AS3SecondaryTypeAuthorityDocument,
    type AS3SecondaryTypeAuthorityLease as RegistryLease,
    type AS3SecondaryTypeAuthorityReservation as RegistryReservation,
} from "./AS3TypeRegistry";

type RuntimeModule = Readonly<Record<string, unknown>>;

export interface AS3SecondaryTypeAuthorityPlan {
    readonly schema: "as3-secondary-type-authority-plan@1";
    readonly sourceClosureSha256: string;
    readonly provider: Readonly<Record<string, unknown>>;
    readonly primaryAuthority: Readonly<{
        readonly runtimeAuthoritySha256: string;
        readonly typeAuthoritySha256: string;
    }>;
    readonly secondaryTypeAuthoritySha256: string;
    readonly qnames: readonly string[];
}

export interface AS3PrimarySecondaryHostAuthority {
    readonly schema: "as3-primary-secondary-host-authority@1";
    readonly runtimeAuthoritySha256: string;
    readonly typeAuthoritySha256: string;
    readonly expectedPlan: AS3SecondaryTypeAuthorityPlan;
    readonly definitions: readonly Readonly<{readonly qname: string; readonly definition: Function}>[];
    readonly runtimeModules: readonly Readonly<{readonly specifier: string; readonly module: RuntimeModule}>[];
}

export interface AS3SecondaryTypeAuthorityLease {
    readonly schema: "as3-secondary-type-authority-lease@1";
    readonly primaryAuthoritySha256: string;
    readonly secondaryTypeAuthoritySha256: string;
    readonly qnames: readonly string[];
    readonly active: boolean;
    seal(): void;
    poison(): void;
}

export interface AS3SecondaryTypeAuthorityReservation {
    readonly schema: "as3-secondary-type-authority-reservation@1";
    readonly primaryAuthoritySha256: string;
    readonly secondaryTypeAuthoritySha256: string;
    readonly qnames: readonly string[];
    readonly active: boolean;
    commit(): AS3SecondaryTypeAuthorityLease;
    abort(): void;
}

export interface AS3SecondaryTypeAuthorityTransaction {
    readonly schema: "as3-secondary-type-authority-transaction@1";
    readonly primaryAuthoritySha256: string;
    readonly secondaryTypeAuthoritySha256: string;
    readonly qnames: readonly string[];
    readonly active: boolean;
    preflight(document: AS3SecondaryTypeAuthorityDocument): AS3SecondaryTypeAuthorityReservation;
    abort(): void;
}

export interface AS3PrimarySecondaryLinkage {
    readonly schema: "as3-primary-secondary-linkage@1";
    readonly runtimeAuthoritySha256: string;
    readonly typeAuthoritySha256: string;
    resolveDefinition(qname: string): unknown;
    resolveRuntimeModule(specifier: string): RuntimeModule;
    beginSecondaryAuthority(plan: AS3SecondaryTypeAuthorityPlan): AS3SecondaryTypeAuthorityTransaction;
}

const SHA256 = /^[0-9a-f]{64}$/;

function exactKeys(value: object, expected: readonly string[], label: string): void {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(key => typeof key !== "string")) throw new TypeError(`${label} has an unexpected shape`);
    const actual = (ownKeys as string[]).sort();
    const keys = [...expected].sort();
    if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
        throw new TypeError(`${label} has an unexpected shape`);
    }
}

function digest(value: unknown, label: string): string {
    if (typeof value !== "string" || !SHA256.test(value)) throw new TypeError(`${label} is invalid`);
    return value;
}

function stableName(value: unknown, label: string): string {
    if (typeof value !== "string" || value === "" || value !== value.trim()
        || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new TypeError(`${label} is invalid`);
    return value;
}

function exactStringList(value: unknown, label: string): readonly string[] {
    if (!Array.isArray(value)) throw new TypeError(`${label} is invalid`);
    const result = value.map((item, index) => stableName(item, `${label} ${index}`));
    if (new Set(result).size !== result.length) throw new TypeError(`${label} contains a duplicate`);
    return Object.freeze(result);
}

function isDataRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function freezeData(value: unknown, label: string, seen = new Set<object>()): unknown {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new TypeError(`${label} contains a cycle`);
        seen.add(value); const result = Object.freeze(value.map((item, index) => freezeData(item, `${label} ${index}`, seen)));
        seen.delete(value); return result;
    }
    if (!isDataRecord(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
        throw new TypeError(`${label} is not closed data`);
    }
    if (seen.has(value as object)) throw new TypeError(`${label} contains a cycle`);
    seen.add(value as object); const result: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string") throw new TypeError(`${label} contains a symbol key`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError(`${label} contains an accessor or hidden key`);
        result[key] = freezeData(descriptor.value, `${label}.${key}`, seen);
    }
    seen.delete(value as object); return Object.freeze(result);
}

function equalData(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length
            && left.every((item, index) => equalData(item, right[index]));
    }
    if (!isDataRecord(left) || !isDataRecord(right)) return false;
    const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]
        && equalData(left[key], right[key]));
}

function validateExpectedPlan(value: AS3SecondaryTypeAuthorityPlan, runtimeSha256: string,
    typeSha256: string): AS3SecondaryTypeAuthorityPlan {
    if (!isDataRecord(value)) throw new TypeError("AS3 secondary expected plan is invalid");
    exactKeys(value, ["schema", "sourceClosureSha256", "provider", "primaryAuthority",
        "secondaryTypeAuthoritySha256", "qnames"], "AS3 secondary expected plan");
    if (value.schema !== "as3-secondary-type-authority-plan@1") {
        throw new TypeError("AS3 secondary expected plan schema is invalid");
    }
    digest(value.sourceClosureSha256, "AS3 secondary source closure SHA-256");
    digest(value.secondaryTypeAuthoritySha256, "AS3 secondary type authority SHA-256");
    if (!isDataRecord(value.provider)) throw new TypeError("AS3 secondary compiler provider is invalid");
    const provider = freezeData(value.provider, "AS3 secondary compiler provider") as Readonly<Record<string, unknown>>;
    if (!isDataRecord(value.primaryAuthority)) throw new TypeError("AS3 secondary primary authority is invalid");
    exactKeys(value.primaryAuthority, ["runtimeAuthoritySha256", "typeAuthoritySha256"],
        "AS3 secondary primary authority");
    if (value.primaryAuthority.runtimeAuthoritySha256 !== runtimeSha256
        || value.primaryAuthority.typeAuthoritySha256 !== typeSha256) {
        throw new TypeError("AS3 secondary expected plan differs from the installed primary authority");
    }
    const qnames = exactStringList(value.qnames, "AS3 secondary expected QName");
    if (qnames.length === 0) throw new TypeError("AS3 secondary expected QName set is empty");
    return Object.freeze({schema: value.schema, sourceClosureSha256: value.sourceClosureSha256,
        provider, primaryAuthority: Object.freeze({runtimeAuthoritySha256: runtimeSha256,
            typeAuthoritySha256: typeSha256}), secondaryTypeAuthoritySha256: value.secondaryTypeAuthoritySha256,
        qnames});
}

/**
 * Package-internal host boundary for one authenticated secondary linker. It exposes
 * literal resolution and lifecycle capabilities, never registry tokens, constructors,
 * reservations, or leases. The generated host must bind this factory's configuration
 * to the authenticated primary runtime bytes and secondary linker receipt.
 */
export function createAS3PrimarySecondaryLinkage(authority: AS3PrimarySecondaryHostAuthority): AS3PrimarySecondaryLinkage {
    if (!isDataRecord(authority)) throw new TypeError("AS3 primary-secondary host authority is invalid");
    exactKeys(authority, ["schema", "runtimeAuthoritySha256", "typeAuthoritySha256", "expectedPlan", "definitions",
        "runtimeModules"], "AS3 primary-secondary host authority");
    if (authority.schema !== "as3-primary-secondary-host-authority@1") {
        throw new TypeError("AS3 primary-secondary host authority schema is invalid");
    }
    const runtimeSha256 = digest(authority.runtimeAuthoritySha256, "AS3 primary runtime authority SHA-256");
    const typeSha256 = digest(authority.typeAuthoritySha256, "AS3 primary type authority SHA-256");
    const status = authorityStatus();
    if (!status.sealed || status.sha256 !== typeSha256) {
        throw new TypeError("AS3 primary type authority is not the exact sealed registry identity");
    }
    const expectedPlan = validateExpectedPlan(authority.expectedPlan, runtimeSha256, typeSha256);
    if (!Array.isArray(authority.definitions) || !Array.isArray(authority.runtimeModules)) {
        throw new TypeError("AS3 primary host literal resolver inventory is invalid");
    }
    const definitions = new Map<string, Function>();
    for (const row of authority.definitions) {
        if (!isDataRecord(row)) throw new TypeError("AS3 primary definition resolver row is invalid");
        exactKeys(row, ["qname", "definition"], "AS3 primary definition resolver row");
        const qname = stableName(row.qname, "AS3 primary definition QName");
        if (typeof row.definition !== "function" || definitions.has(qname)) {
            throw new TypeError("AS3 primary definition resolver identity is invalid or duplicated");
        }
        try { lookupClassType(qname, row.definition as new (...args: any[]) => object); }
        catch { throw new TypeError("AS3 primary definition resolver differs from the exact sealed class identity"); }
        definitions.set(qname, row.definition);
    }
    const runtimeModules = new Map<string, RuntimeModule>();
    for (const row of authority.runtimeModules) {
        if (!isDataRecord(row)) throw new TypeError("AS3 primary runtime resolver row is invalid");
        exactKeys(row, ["specifier", "module"], "AS3 primary runtime resolver row");
        const specifier = stableName(row.specifier, "AS3 primary runtime module specifier");
        if (!isDataRecord(row.module) || runtimeModules.has(specifier)) {
            throw new TypeError("AS3 primary runtime resolver identity is invalid or duplicated");
        }
        runtimeModules.set(specifier, row.module);
    }
    let begun = false;
    let linkage!: AS3PrimarySecondaryLinkage;
    linkage = Object.freeze({
        schema: "as3-primary-secondary-linkage@1" as const,
        runtimeAuthoritySha256: runtimeSha256,
        typeAuthoritySha256: typeSha256,
        resolveDefinition(qname: string): unknown {
            if (this !== linkage || !definitions.has(qname)) {
                throw new TypeError("AS3 primary definition is outside the authenticated literal resolver");
            }
            return definitions.get(qname);
        },
        resolveRuntimeModule(specifier: string): RuntimeModule {
            if (this !== linkage || !runtimeModules.has(specifier)) {
                throw new TypeError("AS3 runtime module is outside the authenticated literal resolver");
            }
            return runtimeModules.get(specifier)!;
        },
        beginSecondaryAuthority(plan: AS3SecondaryTypeAuthorityPlan): AS3SecondaryTypeAuthorityTransaction {
            if (this !== linkage) throw new TypeError("AS3 primary linkage receiver identity differs");
            if (begun) throw new TypeError("AS3 primary linkage may begin its secondary authority only once");
            let candidatePlan: AS3SecondaryTypeAuthorityPlan;
            try { candidatePlan = validateExpectedPlan(plan, runtimeSha256, typeSha256); }
            catch { throw new TypeError("AS3 secondary plan differs from the authenticated literal host plan"); }
            if (!equalData(candidatePlan, expectedPlan)) {
                throw new TypeError("AS3 secondary plan differs from the authenticated literal host plan");
            }
            begun = true;
            let phase: "active" | "reserved" | "aborted" = "active";
            let transaction!: AS3SecondaryTypeAuthorityTransaction;
            transaction = Object.freeze({
                schema: "as3-secondary-type-authority-transaction@1" as const,
                primaryAuthoritySha256: typeSha256,
                secondaryTypeAuthoritySha256: expectedPlan.secondaryTypeAuthoritySha256,
                qnames: expectedPlan.qnames,
                get active(): boolean { return phase === "active"; },
                preflight(document: AS3SecondaryTypeAuthorityDocument): AS3SecondaryTypeAuthorityReservation {
                    if (this !== transaction || phase !== "active") {
                        throw new TypeError("AS3 secondary type transaction is not the active owned identity");
                    }
                    if (!isDataRecord(document) || document.schema !== "as3-runtime-secondary-type-authority@1"
                        || document.primarySha256 !== typeSha256
                        || document.sha256 !== expectedPlan.secondaryTypeAuthoritySha256
                        || !equalData(document.qnames, expectedPlan.qnames)) {
                        throw new TypeError("AS3 secondary live type authority differs from the authenticated plan");
                    }
                    const rawReservation: RegistryReservation = preflightAS3SecondaryTypeAuthority(document);
                    phase = "reserved";
                    let reservationActive = true;
                    let reservation!: AS3SecondaryTypeAuthorityReservation;
                    reservation = Object.freeze({
                        schema: "as3-secondary-type-authority-reservation@1" as const,
                        primaryAuthoritySha256: typeSha256,
                        secondaryTypeAuthoritySha256: expectedPlan.secondaryTypeAuthoritySha256,
                        qnames: expectedPlan.qnames,
                        get active(): boolean { return reservationActive; },
                        commit(): AS3SecondaryTypeAuthorityLease {
                            if (this !== reservation || !reservationActive) {
                                throw new TypeError("AS3 secondary type reservation is not the active owned identity");
                            }
                            const rawLease: RegistryLease = commitAS3SecondaryTypeAuthority(rawReservation);
                            reservationActive = false;
                            let leaseState: "committed" | "sealed" | "poisoned" = "committed";
                            let lease!: AS3SecondaryTypeAuthorityLease;
                            lease = Object.freeze({
                                schema: "as3-secondary-type-authority-lease@1" as const,
                                primaryAuthoritySha256: typeSha256,
                                secondaryTypeAuthoritySha256: expectedPlan.secondaryTypeAuthoritySha256,
                                qnames: expectedPlan.qnames,
                                get active(): boolean { return leaseState !== "poisoned"; },
                                seal(): void {
                                    if (this !== lease || leaseState !== "committed") {
                                        throw new TypeError("AS3 secondary type lease cannot seal in this state");
                                    }
                                    sealAS3SecondaryTypeAuthority(rawLease); leaseState = "sealed";
                                },
                                poison(): void {
                                    if (this !== lease || leaseState === "poisoned") {
                                        throw new TypeError("AS3 secondary type lease cannot poison in this state");
                                    }
                                    poisonAS3SecondaryTypeAuthority(rawLease); leaseState = "poisoned";
                                },
                            });
                            return lease;
                        },
                        abort(): void {
                            if (this !== reservation) throw new TypeError("AS3 secondary type reservation receiver identity differs");
                            if (!reservationActive) return;
                            abortAS3SecondaryTypeAuthority(rawReservation); reservationActive = false;
                        },
                    });
                    return reservation;
                },
                abort(): void {
                    if (this !== transaction) throw new TypeError("AS3 secondary type transaction receiver identity differs");
                    if (phase === "active") phase = "aborted";
                },
            });
            return transaction;
        },
    });
    return linkage;
}

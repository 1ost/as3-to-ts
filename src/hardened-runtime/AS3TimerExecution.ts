/** Host integration only: capture source ownership when a timer is registered. */
export type AS3TimerExecutionCapture = (callback: () => void) => () => void;
export interface AS3TimerExecutionLease { readonly disposed: boolean; dispose(): void; }
declare const timerExecutionPreparationBrand: unique symbol;
/** Opaque, runtime-authenticated ownership of one uncommitted capture reservation. */
export interface AS3TimerExecutionPreparation { readonly [timerExecutionPreparationBrand]: never; }
interface TimerExecutionRegistration {
    capture: AS3TimerExecutionCapture | null;
    phase: "prepared" | "installed" | "aborted" | "disposed";
    lease: AS3TimerExecutionLease;
}
let installed: TimerExecutionRegistration | null = null;
let pending: TimerExecutionRegistration | null = null;
const preparations = new WeakMap<object, TimerExecutionRegistration>();

function preparedCapture(value: AS3TimerExecutionPreparation): TimerExecutionRegistration {
    if ((typeof value !== "object" && typeof value !== "function") || value === null)
        throw new TypeError("AS3 timer execution preparation was not issued by this application runtime");
    const owner = preparations.get(value as object);
    if (!owner) throw new TypeError("AS3 timer execution preparation was not issued by this application runtime");
    return owner;
}

export function prepareAS3TimerExecutionCapture(capture: AS3TimerExecutionCapture): AS3TimerExecutionPreparation {
    if (typeof capture !== "function") throw new TypeError("AS3 timer execution capture must be a function");
    if (installed !== null || pending !== null)
        throw new Error("AS3 timer execution capture is already installed or reserved");
    const owner = {capture,phase:"prepared"} as TimerExecutionRegistration;
    // Construct every caller-visible object before reserving global state.
    owner.lease = Object.freeze({
        get disposed(): boolean { return owner.phase === "disposed"; },
        dispose(): void {
            if (owner.phase === "disposed") return;
            if (owner.phase !== "installed") throw new Error("AS3 timer execution capture lease is not installed");
            if (installed === owner) installed = null;
            owner.capture = null;
            owner.phase = "disposed";
        },
    });
    const preparation = Object.freeze({}) as AS3TimerExecutionPreparation;
    preparations.set(preparation,owner);
    // Reservation publication is the final operation before token delivery.
    pending = owner;
    return preparation;
}

export function commitAS3TimerExecutionCapture(preparation: AS3TimerExecutionPreparation): AS3TimerExecutionLease {
    const owner = preparedCapture(preparation);
    if (owner.phase !== "prepared" || pending !== owner || installed !== null)
        throw new Error("AS3 timer execution preparation is not active");
    owner.phase = "installed";
    pending = null;
    // The lease is already frozen; no fallible work follows publication.
    installed = owner;
    return owner.lease;
}

export function abortAS3TimerExecutionCapture(preparation: AS3TimerExecutionPreparation): void {
    const owner = preparedCapture(preparation);
    if (owner.phase === "aborted") return;
    if (owner.phase !== "prepared" || pending !== owner)
        throw new Error("AS3 timer execution preparation cannot be aborted after commit");
    pending = null;
    owner.capture = null;
    owner.phase = "aborted";
}

export function installAS3TimerExecutionCapture(capture: AS3TimerExecutionCapture): AS3TimerExecutionLease {
    const preparation = prepareAS3TimerExecutionCapture(capture);
    try {
        return commitAS3TimerExecutionCapture(preparation);
    } catch (error) {
        abortAS3TimerExecutionCapture(preparation);
        throw error;
    }
}
/** @internal Existing registrations retain the captured owner across reinstall. */
export function captureAS3TimerExecution(callback: () => void): () => void {
    const owner = installed;
    if (owner === null) return callback;
    const capture = owner.capture;
    if (capture === null) return callback;
    const captured = capture(callback);
    if (typeof captured !== "function") throw new TypeError("AS3 timer execution capture must return a callback");
    return captured;
}

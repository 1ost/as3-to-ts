/** Host integration only: capture source ownership when a timer is registered. */
export type AS3TimerExecutionCapture = (callback: () => void) => () => void;
export interface AS3TimerExecutionLease { readonly disposed: boolean; dispose(): void; }
let installed: { capture: AS3TimerExecutionCapture | null } | null = null;
export function installAS3TimerExecutionCapture(capture: AS3TimerExecutionCapture): AS3TimerExecutionLease {
    if (typeof capture !== "function") throw new TypeError("AS3 timer execution capture must be a function");
    if (installed !== null) throw new Error("AS3 timer execution capture is already installed");
    const owner: { capture: AS3TimerExecutionCapture | null } = {capture};
    installed = owner;
    let disposed = false;
    return Object.freeze({
        get disposed(): boolean { return disposed; },
        dispose(): void {
            if (disposed) return;
            disposed = true;
            if (installed === owner) installed = null;
            owner.capture = null;
        },
    });
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

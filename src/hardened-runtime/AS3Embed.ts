/** The rendering host supplies fresh canonical bitmap data for authenticated Embed resources. */
export type AS3EmbeddedBitmapDataHost = (resourceId: string) => unknown;

/** Owns host selection only. Dispose source objects before releasing the lease,
 * then dispose the separately owned bitmap templates. Already returned bitmap
 * data is not cancelled or disposed by releasing this registration.
 */
export interface AS3EmbeddedBitmapDataHostLease {
    readonly active: boolean;
    readonly disposed: boolean;
    dispose(): void;
}
declare const embeddedBitmapDataHostPreparationBrand: unique symbol;
/** Opaque, runtime-authenticated ownership of one uncommitted host reservation. */
export interface AS3EmbeddedBitmapDataHostPreparation {
    readonly [embeddedBitmapDataHostPreparationBrand]: never;
}
interface EmbeddedHostRegistration {
    host: AS3EmbeddedBitmapDataHost | null;
    phase: "prepared" | "installed" | "aborted" | "disposed";
    lease: AS3EmbeddedBitmapDataHostLease;
}
let bitmapHost: EmbeddedHostRegistration | null = null;
let bitmapHostPreparation: EmbeddedHostRegistration | null = null;
const bitmapHostPreparations = new WeakMap<object, EmbeddedHostRegistration>();

function preparedBitmapHost(value: AS3EmbeddedBitmapDataHostPreparation): EmbeddedHostRegistration {
    if ((typeof value !== "object" && typeof value !== "function") || value === null)
        throw new TypeError("Embedded bitmap host preparation was not issued by this application runtime");
    const registration = bitmapHostPreparations.get(value as object);
    if (!registration) throw new TypeError("Embedded bitmap host preparation was not issued by this application runtime");
    return registration;
}

export function prepareAS3EmbeddedBitmapDataHost(host: AS3EmbeddedBitmapDataHost): AS3EmbeddedBitmapDataHostPreparation {
    if (typeof host !== "function") throw new TypeError("Embedded bitmap host must be callable");
    if (bitmapHost !== null || bitmapHostPreparation !== null)
        throw new Error("Embedded bitmap host already installed or reserved in this application runtime");
    const registration = {host,phase:"prepared"} as EmbeddedHostRegistration;
    // Construct every caller-visible object before reserving global state. If an
    // ambient intrinsic fails here, there is no hidden registration to revoke.
    registration.lease = Object.freeze({
        get active(): boolean { return registration.phase === "installed"; },
        get disposed(): boolean { return registration.phase === "disposed"; },
        dispose(): void {
            if (registration.phase === "disposed") return;
            if (registration.phase !== "installed")
                throw new Error("Embedded bitmap host lease is not installed");
            if (bitmapHost === registration) bitmapHost = null;
            // Retaining the disposer must not retain the template-owner callback.
            registration.host = null;
            registration.phase = "disposed";
        },
    });
    const preparation = Object.freeze({}) as AS3EmbeddedBitmapDataHostPreparation;
    bitmapHostPreparations.set(preparation,registration);
    // Publication of the reservation is the final operation before returning
    // its nominal token; no ambient call can fail after this assignment.
    bitmapHostPreparation = registration;
    return preparation;
}

export function commitAS3EmbeddedBitmapDataHost(
    preparation: AS3EmbeddedBitmapDataHostPreparation): AS3EmbeddedBitmapDataHostLease {
    const registration = preparedBitmapHost(preparation);
    if (registration.phase !== "prepared" || bitmapHostPreparation !== registration || bitmapHost !== null)
        throw new Error("Embedded bitmap host preparation is not active");
    registration.phase = "installed";
    bitmapHostPreparation = null;
    // The lease is already frozen. Publishing the owner is deliberately the
    // last operation before returning that exact revocation capability.
    bitmapHost = registration;
    return registration.lease;
}

export function abortAS3EmbeddedBitmapDataHost(preparation: AS3EmbeddedBitmapDataHostPreparation): void {
    const registration = preparedBitmapHost(preparation);
    if (registration.phase === "aborted") return;
    if (registration.phase !== "prepared" || bitmapHostPreparation !== registration)
        throw new Error("Embedded bitmap host preparation cannot be aborted after commit");
    bitmapHostPreparation = null;
    registration.host = null;
    registration.phase = "aborted";
}

export function installAS3EmbeddedBitmapDataHost(host: AS3EmbeddedBitmapDataHost): AS3EmbeddedBitmapDataHostLease {
    const preparation = prepareAS3EmbeddedBitmapDataHost(host);
    try {
        return commitAS3EmbeddedBitmapDataHost(preparation);
    } catch (error) {
        abortAS3EmbeddedBitmapDataHost(preparation);
        throw error;
    }
}

/** Compiler-only constructor boundary. The mapped native Bitmap constructor validates the host result. */
export function as3EmbeddedBitmapData(resourceId: string): any {
    const host = bitmapHost?.host;
    if (!host) throw new Error("Embedded bitmap resources must be prepared before constructing application classes");
    const value = host(resourceId);
    if (typeof value !== "object" || value === null) throw new TypeError("Embedded bitmap host returned no bitmap data");
    return value;
}

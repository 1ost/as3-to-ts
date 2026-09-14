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
interface EmbeddedHostRegistration { host: AS3EmbeddedBitmapDataHost | null; }
let bitmapHost: EmbeddedHostRegistration | null = null;

export function installAS3EmbeddedBitmapDataHost(host: AS3EmbeddedBitmapDataHost): AS3EmbeddedBitmapDataHostLease {
    if (typeof host !== "function") throw new TypeError("Embedded bitmap host must be callable");
    if (bitmapHost !== null) throw new Error("Embedded bitmap host already installed in this application runtime");
    const registration: EmbeddedHostRegistration = {host};
    bitmapHost = registration;
    let disposed = false;
    return Object.freeze({
        get active(): boolean { return !disposed; },
        get disposed(): boolean { return disposed; },
        dispose(): void {
            if (disposed) return;
            disposed = true;
            if (bitmapHost === registration) bitmapHost = null;
            // Retaining the disposer must not retain the template-owner callback.
            registration.host = null;
        },
    });
}

/** Compiler-only constructor boundary. The mapped native Bitmap constructor validates the host result. */
export function as3EmbeddedBitmapData(resourceId: string): any {
    const host = bitmapHost?.host;
    if (!host) throw new Error("Embedded bitmap resources must be prepared before constructing application classes");
    const value = host(resourceId);
    if (typeof value !== "object" || value === null) throw new TypeError("Embedded bitmap host returned no bitmap data");
    return value;
}

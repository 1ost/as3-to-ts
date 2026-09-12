/** The rendering host supplies fresh canonical bitmap data for authenticated Embed resources. */
export type AS3EmbeddedBitmapDataHost = (resourceId: string) => unknown;

let bitmapHost: AS3EmbeddedBitmapDataHost | null = null;

export function installAS3EmbeddedBitmapDataHost(host: AS3EmbeddedBitmapDataHost): void {
    if (typeof host !== "function") throw new TypeError("Embedded bitmap host must be callable");
    if (bitmapHost !== null) throw new Error("Embedded bitmap host already installed in this application runtime");
    bitmapHost = host;
}

/** Compiler-only constructor boundary. The mapped native Bitmap constructor validates the host result. */
export function as3EmbeddedBitmapData(resourceId: string): any {
    if (bitmapHost === null) throw new Error("Embedded bitmap resources must be prepared before constructing application classes");
    const value = bitmapHost(resourceId);
    if (typeof value !== "object" || value === null) throw new TypeError("Embedded bitmap host returned no bitmap data");
    return value;
}

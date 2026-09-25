export interface AS3ByteArrayNativeState {
    readonly bytes: Uint8Array;
    readonly position: number;
    readonly endian: string;
}

/** Replaced only by the compiler's target-proof-bound shared Laya facade. */
export function uncompressNativeByteArray(_state:AS3ByteArrayNativeState, _algorithm?:unknown):AS3ByteArrayNativeState {
    throw new Error("ByteArray.uncompress requires an authenticated shared native target");
}

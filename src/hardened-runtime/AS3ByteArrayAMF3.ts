/** Replaced only by the compiler's authenticated common raw AMF3 provider. */
export function readNativeByteArrayObject(_bytes: Uint8Array, _position: number,
    _createByteArray: (bytes: Uint8Array) => unknown, _commitPosition: (position: number) => void): unknown {
    throw new Error("ByteArray.readObject requires an authenticated shared AMF3 target");
}

/** Replaced only by the compiler's authenticated common raw AMF3 provider. */
export function writeNativeByteArrayObject(_value: unknown,
    _readByteArray: (value: unknown) => Uint8Array | null): Uint8Array {
    throw new Error("ByteArray.writeObject requires an authenticated shared AMF3 target");
}

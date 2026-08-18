export class AS3Endian {
    public static readonly BIG_ENDIAN: string = "bigEndian";
    public static readonly LITTLE_ENDIAN: string = "littleEndian";

    private constructor() {
        throw new TypeError("Endian is not constructible");
    }
}

const MAX_BYTEARRAY_LENGTH = 256 * 1024 * 1024;
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });

function uint32(value: number, label: string): number {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite uint`);
    return value >>> 0;
}

function checkedLength(value: number, label: string): number {
    const result = uint32(value, label);
    if (result > MAX_BYTEARRAY_LENGTH) throw new RangeError(`${label} exceeds the native ByteArray resource limit`);
    return result;
}

function arrayIndex(property: PropertyKey): number | null {
    if (typeof property !== "string" || !ARRAY_INDEX.test(property)) return null;
    const value = Number(property);
    return Number.isSafeInteger(value) && value <= 0xffffffff ? value : null;
}

export class AS3EOFError extends Error {
    public readonly errorID: number = 2030;

    public constructor(message: string = "End of file was encountered.") {
        super(message);
        this.name = "EOFError";
    }
}

export type AS3SystemCodePageEncoder = (value: string) => Uint8Array;

let systemCodePageEncoder: AS3SystemCodePageEncoder | null = null;

/**
 * Host seam for Flash's platform-default code page. The maintained client uses
 * writeMultiByte(value, "") to measure text input in that code page. Browsers
 * expose no equivalent encoder, so the native bootstrap must install the exact
 * deployment encoder instead of silently substituting UTF-8.
 */
export function configureAS3SystemCodePageEncoder(encoder: AS3SystemCodePageEncoder): void {
    if (typeof encoder !== "function") throw new TypeError("system code page encoder must be a function");
    systemCodePageEncoder = encoder;
}

/**
 * Native TypeScript implementation of the source-visible Flash ByteArray binary subset.
 * AMF object serialization and synchronous compression are deliberately not exposed here;
 * the semantic adapter keeps those source members on HOLD until their codecs are proven.
 */
export class AS3ByteArray {
    [index: number]: number;
    private _bytes: Uint8Array = new Uint8Array(8);
    private _length: number = 0;
    private _position: number = 0;
    private _littleEndian: boolean = false;
    private readonly _closures = new Map<PropertyKey, Function>();

    public constructor() {
        return new Proxy(this, {
            get: (target, property, receiver) => {
                const index = arrayIndex(property);
                if (index !== null) return target._getIndex(index);
                const value = Reflect.get(target, property, receiver);
                if (typeof value !== "function" || property === "constructor") return value;
                let closure = target._closures.get(property);
                if (!closure) {
                    closure = value.bind(receiver) as Function;
                    target._closures.set(property, closure);
                }
                return closure;
            },
            set: (target, property, value, receiver) => {
                const index = arrayIndex(property);
                if (index !== null) {
                    target._setIndex(index, value);
                    return true;
                }
                return Reflect.set(target, property, value, receiver);
            },
            has: (target, property) => {
                const index = arrayIndex(property);
                return index === null ? Reflect.has(target, property) : index < target._length;
            },
        });
    }

    public get bytesAvailable(): number {
        return this._position >= this._length ? 0 : this._length - this._position;
    }

    public get endian(): string {
        return this._littleEndian ? AS3Endian.LITTLE_ENDIAN : AS3Endian.BIG_ENDIAN;
    }

    public set endian(value: string) {
        if (value !== AS3Endian.BIG_ENDIAN && value !== AS3Endian.LITTLE_ENDIAN) {
            throw new TypeError("ByteArray.endian must be Endian.BIG_ENDIAN or Endian.LITTLE_ENDIAN");
        }
        this._littleEndian = value === AS3Endian.LITTLE_ENDIAN;
    }

    public get length(): number {
        return this._length;
    }

    public set length(value: number) {
        const next = checkedLength(value, "ByteArray.length");
        this._ensureCapacity(next);
        if (next < this._length) this._bytes.fill(0, next, this._length);
        else if (next > this._length) this._bytes.fill(0, this._length, next);
        this._length = next;
    }

    public get position(): number {
        return this._position;
    }

    public set position(value: number) {
        this._position = uint32(value, "ByteArray.position");
    }

    /** Host transport seam; it is not used as a replacement for a Flash source member. */
    public toArrayBuffer(): ArrayBuffer {
        return this._bytes.slice(0, this._length).buffer as ArrayBuffer;
    }

    /** Host transport seam for authenticated WebSocket/resource bytes. */
    public static fromArrayBuffer(value: ArrayBuffer | ArrayBufferView): AS3ByteArray {
        const source = value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        checkedLength(source.byteLength, "ByteArray host source length");
        const result = new AS3ByteArray();
        result._ensureCapacity(source.byteLength);
        result._bytes.set(source);
        result._length = source.byteLength;
        return result;
    }

    public clear(): void {
        this._bytes.fill(0, 0, this._length);
        this._length = 0;
        this._position = 0;
    }

    public readBoolean(): boolean {
        return this.readUnsignedByte() !== 0;
    }

    public readByte(): number {
        this._requireReadable(1);
        const result = this._view().getInt8(this._position);
        this._position += 1;
        return result;
    }

    public readBytes(bytes: AS3ByteArray, offset: number = 0, length: number = 0): void {
        if (!(bytes instanceof AS3ByteArray)) throw new TypeError("readBytes target must be ByteArray");
        const targetOffset = uint32(offset, "readBytes offset");
        const count = length === 0 ? this.bytesAvailable : uint32(length, "readBytes length");
        this._requireReadable(count);
        const end = targetOffset + count;
        if (!Number.isSafeInteger(end) || end > MAX_BYTEARRAY_LENGTH) throw new RangeError("readBytes target range is invalid");
        bytes._ensureCapacity(end);
        bytes._bytes.set(this._bytes.subarray(this._position, this._position + count), targetOffset);
        bytes._length = Math.max(bytes._length, end);
        this._position += count;
    }

    public readDouble(): number {
        this._requireReadable(8);
        const result = this._view().getFloat64(this._position, this._littleEndian);
        this._position += 8;
        return result;
    }

    public readFloat(): number {
        this._requireReadable(4);
        const result = this._view().getFloat32(this._position, this._littleEndian);
        this._position += 4;
        return result;
    }

    public readInt(): number {
        this._requireReadable(4);
        const result = this._view().getInt32(this._position, this._littleEndian);
        this._position += 4;
        return result;
    }

    public readShort(): number {
        this._requireReadable(2);
        const result = this._view().getInt16(this._position, this._littleEndian);
        this._position += 2;
        return result;
    }

    public readUTF(): string {
        const byteLength = this.readUnsignedShort();
        return this.readUTFBytes(byteLength);
    }

    public readUTFBytes(length: number): string {
        const count = uint32(length, "readUTFBytes length");
        this._requireReadable(count);
        const result = UTF8_DECODER.decode(this._bytes.subarray(this._position, this._position + count));
        this._position += count;
        return result;
    }

    public readUnsignedByte(): number {
        this._requireReadable(1);
        return this._bytes[this._position++]!;
    }

    public readUnsignedInt(): number {
        this._requireReadable(4);
        const result = this._view().getUint32(this._position, this._littleEndian);
        this._position += 4;
        return result;
    }

    public readUnsignedShort(): number {
        this._requireReadable(2);
        const result = this._view().getUint16(this._position, this._littleEndian);
        this._position += 2;
        return result;
    }

    public writeBoolean(value: boolean): void {
        if (typeof value !== "boolean") throw new TypeError("writeBoolean value must be Boolean");
        this.writeByte(value ? 1 : 0);
    }

    public writeByte(value: number): void {
        this._prepareWrite(1);
        this._view().setInt8(this._position, value | 0);
        this._finishWrite(1);
    }

    public writeBytes(bytes: AS3ByteArray, offset: number = 0, length: number = 0): void {
        if (!(bytes instanceof AS3ByteArray)) throw new TypeError("writeBytes source must be ByteArray");
        const sourceOffset = Math.min(uint32(offset, "writeBytes offset"), bytes._length);
        const available = bytes._length - sourceOffset;
        const requested = length === 0 ? available : uint32(length, "writeBytes length");
        const count = Math.min(requested, available);
        this._prepareWrite(count);
        const source = bytes === this
            ? bytes._bytes.slice(sourceOffset, sourceOffset + count)
            : bytes._bytes.subarray(sourceOffset, sourceOffset + count);
        this._bytes.set(source, this._position);
        this._finishWrite(count);
    }

    public writeDouble(value: number): void {
        this._prepareWrite(8);
        this._view().setFloat64(this._position, Number(value), this._littleEndian);
        this._finishWrite(8);
    }

    public writeFloat(value: number): void {
        this._prepareWrite(4);
        this._view().setFloat32(this._position, Number(value), this._littleEndian);
        this._finishWrite(4);
    }

    public writeInt(value: number): void {
        this._prepareWrite(4);
        this._view().setInt32(this._position, value | 0, this._littleEndian);
        this._finishWrite(4);
    }

    public writeMultiByte(value: string, charSet: string): void {
        if (typeof value !== "string" || typeof charSet !== "string") {
            throw new TypeError("writeMultiByte requires String value and charSet");
        }
        let bytes: Uint8Array;
        const normalized = charSet.toLowerCase().replace(/[_\s]/g, "-");
        if (normalized === "utf-8" || normalized === "utf8") {
            bytes = UTF8_ENCODER.encode(value);
        } else if (charSet === "") {
            if (systemCodePageEncoder === null) {
                throw new TypeError("writeMultiByte default code page requires an installed native encoder");
            }
            bytes = systemCodePageEncoder(value);
            if (!(bytes instanceof Uint8Array)) {
                throw new TypeError("system code page encoder must return Uint8Array");
            }
        } else {
            throw new TypeError(`writeMultiByte charset is not admitted: ${charSet}`);
        }
        this._prepareWrite(bytes.byteLength);
        this._bytes.set(bytes, this._position);
        this._finishWrite(bytes.byteLength);
    }

    public writeShort(value: number): void {
        this._prepareWrite(2);
        this._view().setInt16(this._position, value | 0, this._littleEndian);
        this._finishWrite(2);
    }

    public writeUTF(value: string): void {
        if (typeof value !== "string") throw new TypeError("writeUTF value must be String");
        const bytes = UTF8_ENCODER.encode(value);
        if (bytes.byteLength > 0xffff) throw new RangeError("writeUTF payload exceeds 65535 UTF-8 bytes");
        this._prepareWrite(2 + bytes.byteLength);
        this._view().setUint16(this._position, bytes.byteLength, this._littleEndian);
        this._bytes.set(bytes, this._position + 2);
        this._finishWrite(2 + bytes.byteLength);
    }

    public writeUTFBytes(value: string): void {
        if (typeof value !== "string") throw new TypeError("writeUTFBytes value must be String");
        const bytes = UTF8_ENCODER.encode(value);
        this._prepareWrite(bytes.byteLength);
        this._bytes.set(bytes, this._position);
        this._finishWrite(bytes.byteLength);
    }

    public writeUnsignedInt(value: number): void {
        this._prepareWrite(4);
        this._view().setUint32(this._position, uint32(value, "writeUnsignedInt value"), this._littleEndian);
        this._finishWrite(4);
    }

    private _view(): DataView {
        return new DataView(this._bytes.buffer, this._bytes.byteOffset, this._bytes.byteLength);
    }

    private _requireReadable(count: number): void {
        if (!Number.isSafeInteger(count) || count < 0 || this._position + count > this._length) {
            throw new AS3EOFError();
        }
    }

    private _getIndex(index: number): number {
        if (index >= this._length) throw new RangeError("ByteArray index exceeds length");
        return this._bytes[index]!;
    }

    private _setIndex(index: number, value: unknown): void {
        // The largest canonical uint index cannot be represented as a ByteArray
        // length: adding one would wrap through the source-visible uint coercion.
        // Reject it before checkedLength rather than silently treating the write
        // as an empty/no-op extension.
        if (index >= MAX_BYTEARRAY_LENGTH) {
            throw new RangeError("ByteArray indexed write exceeds the native ByteArray resource limit");
        }
        const end = checkedLength(index + 1, "ByteArray indexed write");
        this._ensureCapacity(end);
        if (index > this._length) this._bytes.fill(0, this._length, index);
        this._bytes[index] = Number(value) & 0xff;
        this._length = Math.max(this._length, end);
    }

    private _prepareWrite(count: number): void {
        if (!Number.isSafeInteger(count) || count < 0 || this._position + count > MAX_BYTEARRAY_LENGTH) {
            throw new RangeError("ByteArray write range is invalid");
        }
        this._ensureCapacity(this._position + count);
        if (this._position > this._length) this._bytes.fill(0, this._length, this._position);
    }

    private _finishWrite(count: number): void {
        this._position += count;
        this._length = Math.max(this._length, this._position);
    }

    private _ensureCapacity(required: number): void {
        if (!Number.isSafeInteger(required) || required < 0 || required > MAX_BYTEARRAY_LENGTH) {
            throw new RangeError("ByteArray capacity exceeds the native resource limit");
        }
        if (required <= this._bytes.byteLength) return;
        let capacity = Math.max(8, this._bytes.byteLength);
        while (capacity < required) {
            const doubled = capacity * 2;
            capacity = doubled > MAX_BYTEARRAY_LENGTH ? required : Math.max(required, doubled);
        }
        const next = new Uint8Array(capacity);
        next.set(this._bytes.subarray(0, this._length));
        this._bytes = next;
    }
}

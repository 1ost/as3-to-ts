declare const ownRecordBrand: unique symbol;
const ownedRecords = new WeakSet<object>();

export interface AS3OwnRecord<T> {
    readonly [ownRecordBrand]: true;
}

export function as3CreateOwnRecord<T>(): AS3OwnRecord<T> {
    const record = Object.create(null) as AS3OwnRecord<T>;
    ownedRecords.add(record);
    return record;
}

function propertyKey(key: string | null): string {
    return key === null ? "null" : key;
}

function assertOwnRecord<T>(record: AS3OwnRecord<T>): void {
    if (typeof record !== "object" || record === null || !ownedRecords.has(record)) {
        throw new TypeError("AS3 own-record boundary rejected an unauthenticated object");
    }
}

export function as3OwnRecordGet<T>(record: AS3OwnRecord<T>, key: string | null): T | null {
    assertOwnRecord(record);
    const descriptor = Object.getOwnPropertyDescriptor(record, propertyKey(key));
    return descriptor === undefined || !("value" in descriptor) ? null : descriptor.value as T;
}

export function as3OwnRecordSet<T>(record: AS3OwnRecord<T>, key: string | null, value: T | null): T {
    assertOwnRecord(record);
    if (value === null) throw new TypeError("AS3 own-record values must be non-null authenticated instances");
    Object.defineProperty(record, propertyKey(key), {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
    });
    return value;
}

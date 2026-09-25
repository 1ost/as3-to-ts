/** Replaced only by the authenticated shared JSON definition provider. */
export function isNativeJSONDefinition(_value: unknown): boolean { return false; }
export function callNativeJSONDefinition(_value: unknown, _name: string, _args: unknown[],
    _coerceString: (value: unknown) => string | null): unknown {
    throw new Error("JSON definition calls require an authenticated shared provider");
}

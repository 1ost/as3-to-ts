/** A source Class can shadow host Function fields such as name. */
export interface NativeClassConstructor { new(...args: any[]): any; readonly prototype: any; }

interface NativeClassBinding {
    factory: (finalize: <T extends NativeClassConstructor>(value: T) => T) => NativeClassConstructor;
    initializing: boolean;
    value: NativeClassConstructor;
}

const bindings = new WeakMap<object, NativeClassBinding>();

/** A compiler binding, never an authored Class value. All source reads must use
 * readNativeClass. Keeping native class construction inside the factory defers
 * its base resolution and permits fresh allocation after a failed initializer.
 */
export function declareNativeClass<T extends NativeClassConstructor>(factory: (finalize: <V extends NativeClassConstructor>(value: V) => V) => T): T {
    if (typeof factory !== 'function') throw new TypeError('Native class factory must be callable');
    const fail = (): never => { throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved native class binding'); };
    const handle = new Proxy(function (): never { return fail(); }, {
        get: fail, set: fail, construct: fail, apply: fail,
    });
    bindings.set(handle, {factory, initializing: false, value: null});
    return handle as any as T;
}

function finalizeIdentity<T extends NativeClassConstructor>(value: T): T {
    const prototype = value && value.prototype;
    const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, 'constructor');
    if (!constructor || !constructor.configurable || typeof constructor.value !== 'function')
        throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: native class prototype identity is not writable');
    Object.defineProperty(prototype, 'constructor', {
        value, writable: constructor.writable, enumerable: constructor.enumerable, configurable: constructor.configurable,
    });
    return value;
}

/** Source getlex publication: a recursively requested, not-yet-published class
 * is null. An exception preserves identity and leaves the factory retryable.
 * This intentionally does not guess that an arbitrary native function is a
 * registered source class or initialize unrelated eager provider classes.
 */
export function readNativeClass<T extends NativeClassConstructor>(handle: T, context: 'value' | 'read' | 'unsupported' = 'value'): T {
    const binding = bindings.get(handle);
    if (!binding) throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unknown native class binding');
    if (binding.value) return binding.value as T;
    if (binding.initializing) {
        if (context === 'read') {
            const failure = new TypeError('Error #1009');
            Object.defineProperty(failure, 'errorID', {value: 1009});
            throw failure;
        }
        if (context !== 'value') throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: cyclic class use requires additional source evidence');
        return null;
    }
    binding.initializing = true;
    try {
        const value = binding.factory(finalizeIdentity);
        if (typeof value !== 'function') throw new TypeError('Native class factory must return a constructor');
        binding.value = value;
        return value as T;
    } finally {
        binding.initializing = false;
    }
}

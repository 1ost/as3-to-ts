const BOUND_METHODS = Symbol('as3-to-ts.boundMethods');

/** Bind method closures on first access, including access inside constructors. */
export function bound(target: any, propKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
    const method = descriptor.value;
    if (typeof method !== 'function') throw new TypeError('@bound requires a method');
    if (!Object.prototype.hasOwnProperty.call(target, BOUND_METHODS)) {
        Object.defineProperty(target, BOUND_METHODS, { value: new Set<PropertyKey>() });
    }
    target[BOUND_METHODS].add(propKey);
    const closures = new WeakMap<object, Function>();
    const getter = function(this: any): Function {
        if (this === target) return method;
        let closure = closures.get(this);
        if (!closure) {
            closure = method.bind(this);
            closures.set(this, closure);
        }
        // A super.method access must never replace the derived override's
        // instance property. Install only when ordinary lookup selects us.
        if (!Object.prototype.hasOwnProperty.call(this, propKey)) {
            for (let proto = Object.getPrototypeOf(this); proto; proto = Object.getPrototypeOf(proto)) {
                const selected = Object.getOwnPropertyDescriptor(proto, propKey);
                if (!selected) continue;
                if (selected.get === getter) {
                    Object.defineProperty(this, propKey, { value: closure, writable: true,
                        configurable: true, enumerable: true });
                }
                break;
            }
        }
        return closure;
    };
    return { configurable: descriptor.configurable, enumerable: descriptor.enumerable, get: getter,
        set(this: any, value: any): void {
            Object.defineProperty(this, propKey, { value, writable: true, configurable: true, enumerable: true });
        } };
}

/** Preserve the existing eager, own-method shape once construction completes. */
export function bindDeclaredInstanceMethods(instance: any): void {
    if (instance === null || (typeof instance !== 'object' && typeof instance !== 'function')) return;
    const seen = new Set<PropertyKey>();
    for (let proto = Object.getPrototypeOf(instance); proto; proto = Object.getPrototypeOf(proto)) {
        const declared: Set<PropertyKey> = Object.prototype.hasOwnProperty.call(proto, BOUND_METHODS)
            ? proto[BOUND_METHODS] : null;
        for (const key of Reflect.ownKeys(proto)) {
            if (seen.has(key)) continue;
            seen.add(key);
            if (declared && declared.has(key) && !Object.prototype.hasOwnProperty.call(instance, key)) {
                // This invokes only the selected @bound getter, not the method.
                Reflect.get(instance, key);
            }
        }
    }
}

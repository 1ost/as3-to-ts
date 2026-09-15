/** Captured outside every authored module/scope. No constructor body lives here. */
export interface NativeCallableFunction extends Function {}
const constructors = new WeakMap<Function, Function>();
interface ConstructionEntry {
    status: 'active' | 'completed' | 'failed';
    stack: Function[];
    expected: Function;
}
const entries = new WeakMap<object, ConstructionEntry>();
function failure(id: number, name: string): Error {
    const error = new Error('Error #' + id);
    error.name = name;
    Object.defineProperty(error, 'errorID', {value:id});
    return error;
}
export const callableClassIntrinsics = Object.freeze({
    defineProperty: Object.defineProperty,
    getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
    getPrototypeOf: Object.getPrototypeOf,
    create: Object.create,
    assign: Object.assign,
    setPrototypeOf: Object.setPrototypeOf,
    number: Number,
    array: Array,
    arraySlice: Array.prototype.slice,
    apply: Reflect.apply,
    arityError: (): Error => failure(1063, 'ArgumentError'),
    register(ctor: Function, base: Function): void {
        if (constructors.has(ctor) || base && !constructors.has(base))
            throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: unregistered/mixed constructor chain');
        constructors.set(ctor, base);
    },
    enter(receiver: any, ctor: Function): boolean {
        if (!constructors.has(ctor) || receiver === null || typeof receiver !== 'object') throw failure(1006, 'TypeError');
        const entry = entries.get(receiver);
        if (entry) {
            if (entry.status !== 'active' || entry.expected !== ctor) throw failure(1006, 'TypeError');
            entry.expected = null; entry.stack.push(ctor); return false;
        }
        if (Object.getPrototypeOf(receiver) !== ctor.prototype) throw failure(1006, 'TypeError');
        entries.set(receiver, {status:'active', stack:[ctor], expected:null});
        return true;
    },
    expectBase(receiver: object, owner: Function, base: Function): void {
        const entry = entries.get(receiver);
        if (!entry || entry.status !== 'active' || entry.expected || entry.stack[entry.stack.length - 1] !== owner
            || constructors.get(owner) !== base) throw failure(1006, 'TypeError');
        entry.expected = base;
    },
    leave(receiver: object, ctor: Function, succeeded: boolean): void {
        const entry = entries.get(receiver);
        if (!entry || entry.stack[entry.stack.length - 1] !== ctor)
            throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: mismatched construction entry');
        entry.stack.pop(); entry.expected = null;
        if (!succeeded) entry.status = 'failed';
        else if (entry.stack.length === 0) entry.status = 'completed';
    },
});

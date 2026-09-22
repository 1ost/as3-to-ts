/** Captured outside every authored module/scope. No constructor body lives here. */
export interface NativeCallableFunction extends Function {}
const constructors = new WeakMap<Function, Function>();
interface NativeBaseEntry {constructor:Function;prepareInstance:(receiver:object)=>void;initializeInstance:(receiver:object,args:readonly unknown[])=>void;}
const nativeBases = new WeakMap<Function,NativeBaseEntry>();
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
    symbol: Symbol,
    arraySlice: Array.prototype.slice,
    apply: Reflect.apply,
    arityError: (): Error => failure(1063, 'ArgumentError'),
    registerNativeBase(ctor:Function,adapter:NativeBaseEntry):void {
        if(!adapter||!Object.isFrozen(adapter)||['constructor','prepareInstance','initializeInstance'].some(key=>{
            const field=Object.getOwnPropertyDescriptor(adapter,key);return !field||!('value' in field)||typeof field.value!=='function';
        })||adapter.constructor!==ctor||nativeBases.has(ctor)&&nativeBases.get(ctor)!==adapter
            ||constructors.has(ctor)&&!nativeBases.has(ctor))throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: native base entry authority');
        nativeBases.set(ctor,adapter);constructors.set(ctor,null);
    },
    prepareNativeBase(receiver:object,base:Function):void {
        const entry=entries.get(receiver),adapter=nativeBases.get(base);
        if(!entry||entry.status!=='active'||entry.stack.length!==1||!adapter)throw failure(1006,'TypeError');
        let parent=entry.stack[0];while(parent&&parent!==base)parent=constructors.get(parent);
        if(parent!==base)throw failure(1006,'TypeError');
        adapter.prepareInstance(receiver);
    },
    callNativeBase(receiver:object,owner:Function,base:Function,args:readonly unknown[]):void {
        const entry=entries.get(receiver),adapter=nativeBases.get(base);
        if(!entry||entry.status!=='active'||entry.expected||entry.stack[entry.stack.length-1]!==owner
            ||constructors.get(owner)!==base||!adapter)throw failure(1006,'TypeError');
        adapter.initializeInstance(receiver,args);
    },
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

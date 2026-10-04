/** A source Class can shadow host Function fields such as name. */
export interface NativeClassConstructor { new(...args: any[]): any; readonly prototype: any; }

interface NativeClassBinding {
    factory: (finalize: <T extends NativeClassConstructor>(value: T) => T) => NativeClassConstructor;
    initializing: boolean;
    value: NativeClassConstructor;
    sourceUnit?: NativeClassSourceUnit;
    sourceIndex?: number;
}

interface NativeClassSourceUnit {
    active: boolean;
    ready: boolean;
    values: NativeClassConstructor[];
    helperLookups: Map<number, NativeClassConstructor>;
    run: () => void;
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

/** Bind one authenticated source file before evaluating any of its Classes.
 * Publication is supplied by the common engine; this layer owns lazy factories
 * and the lifetime of a source getlex selection (including an early null). */
export function bindNativeClassSourceUnit(handles: NativeClassConstructor[],
    instantiate: (factories: Array<() => NativeClassConstructor>) => void): void {
    if (!Array.isArray(handles) || !handles.length || typeof instantiate !== 'function')
        throw new TypeError('Native source unit requires Class handles and an instantiator');
    const members = handles.map(handle => bindings.get(handle));
    if (members.some(binding => !binding || binding.sourceUnit || binding.initializing || binding.value)
        || new Set(handles).size !== handles.length)
        throw new TypeError('Native source unit requires distinct uninitialized Class handles');
    const unit: NativeClassSourceUnit = {active:false,ready:false,values:[],helperLookups:new Map(),run:()=>{
        unit.active=true;unit.values=members.map(()=>null);
        let next=0;
        try {
            instantiate(members.map((binding,index)=>()=>{
                if (!unit.active || index !== next) throw new TypeError('Native source Class initialization order');
                const value=binding.factory(finalizeIdentity);
                if (typeof value !== 'function') throw new TypeError('Native class factory must return a constructor');
                unit.values[index]=value;next++;return value;
            }));
            if(next!==members.length)throw new TypeError('Native source unit initialization is incomplete');
            unit.ready=true;
        } finally {unit.active=false;if(!unit.ready)unit.values=[];}
    }};
    members.forEach((binding,index)=>{binding.sourceUnit=unit;binding.sourceIndex=index;});
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
    if (binding.sourceUnit) {
        const unit=binding.sourceUnit,index=binding.sourceIndex;
        const cached=index > 0 && unit.helperLookups.has(index);
        if (!cached && !unit.active && !unit.ready) unit.run();
        const value=cached?unit.helperLookups.get(index):unit.values[index];
        if (index > 0) unit.helperLookups.set(index,value);
        if (!value && context === 'read') {
            const failure=new TypeError('Error #1009');Object.defineProperty(failure,'errorID',{value:1009});throw failure;
        }
        if (!value && context !== 'value') throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: cyclic class use requires additional source evidence');
        return value as T;
    }
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

import {
    AS3Types,
    AS3TypeToken,
    AS3ClassValue,
    RuntimeConstructor,
    asType,
    castReference,
    lookupClassType,
    lookupInterfaceType,
    lookupNamedReferenceType,
    referenceType,
    testType,
    initializeInstanceFields,
    prepareConstruction,
    cancelPreparedConstruction,
    enterConstruction,
    abortConstruction,
    completeConstruction,
    lookupStringClassName,
    lookupObjectClass,
    lookupDynamicConstruction,
} from "./internal/AS3TypeRegistry";
import { isAS3MethodClosure } from "./AS3MethodClosure";

export { AS3Types };
export type { AS3TypeToken, AS3ClassValue };

/** Query existing sealed allocation authority without reading application fields. */
export function as3ReflectionClassIdentity(value: unknown): string | null {
    if (isAS3MethodClosure(value)) return "builtin.as$0::MethodClosure";
    const className = lookupStringClassName(value);
    if (className !== null) return className;
    return lookupObjectClass(value)?.qname ?? null;
}

export function as3ClassType<T extends object>(name: string,
    constructor: RuntimeConstructor<T>): AS3TypeToken<T> {
    return lookupClassType(name, constructor);
}

export function as3InterfaceType<T extends object>(name: string): AS3TypeToken<T> {
    return lookupInterfaceType(name);
}

export function as3NamedReferenceType<T extends object>(name: string): AS3TypeToken<T> {
    return lookupNamedReferenceType(name);
}

export function as3Is<T>(value: unknown, type: AS3TypeToken<T>): value is T {
    return testType(value, type);
}

export function as3As<T>(value: unknown, type: AS3TypeToken<T>): T | null {
    return asType(value, type);
}

export function as3Cast<T extends object>(value: unknown, type: AS3TypeToken<T>): T | null {
    return castReference(value, type);
}

/** Unshadowable generated-constructor failure seam. It never observes application values. */
export function as3RejectConstructorArity(className: string, minimum: number, maximum: number | null, actual?: number): never {
    if (typeof className !== "string" || className.length === 0 || !Number.isSafeInteger(minimum) || minimum < 0
        || (maximum !== null && (!Number.isSafeInteger(maximum) || maximum < minimum))) {
        throw new TypeError("AS3 constructor arity authority is invalid");
    }
    if (actual !== undefined) {
        if (!Number.isSafeInteger(actual) || actual < 0) throw new TypeError("AS3 constructor argument count is invalid");
        const dot=className.lastIndexOf(".");
        const label=dot < 0 ? className : className.slice(0,dot)+"::"+className.slice(dot+1);
        const error=new Error(`Error #1063: Argument count mismatch on ${label}(). Expected ${minimum}, got ${actual}.`);
        error.name="ArgumentError";Object.defineProperty(error,"errorID",{value:1063});throw error;
    }
    const expected = maximum === null ? `at least ${minimum}` : minimum === maximum ? `exactly ${minimum}`
        : `between ${minimum} and ${maximum}`;
    throw new TypeError(`AS3 constructor ${className} requires ${expected} arguments`);
}

export function as3ReferenceType<T extends object>(name: string,
    runtimeValue: RuntimeConstructor<T> | AS3TypeToken<T>): AS3TypeToken<T> {
    return referenceType(name, runtimeValue);
}

/** Generated-constructor seam; it initializes slots only for an authenticated pending allocation. */
export function as3InitializeInstanceFields(value: object, newTarget: RuntimeConstructor): void {
    initializeInstanceFields(value, newTarget);
}

export function as3PrepareConstruction(newTarget: unknown, declared: RuntimeConstructor,
    proof: unknown): readonly [] {
    return prepareConstruction(newTarget, declared, proof);
}

export function as3CancelPreparedConstruction(newTarget: unknown, proof: unknown, frame: unknown): void {
    cancelPreparedConstruction(newTarget, proof, frame);
}

export function as3EnterConstruction(value: object, newTarget: unknown,
    declared: RuntimeConstructor, proof: unknown): void {
    enterConstruction(value, newTarget, declared, proof);
}

export function as3AbortConstruction(value: object, newTarget: unknown,
    declared: RuntimeConstructor, proof: unknown): void {
    abortConstruction(value, newTarget, declared, proof);
}

export function as3CompleteConstruction(value: object, newTarget: unknown,
    declared: RuntimeConstructor, proof: unknown): void {
    completeConstruction(value, newTarget, declared, proof);
}


export class AS3ClassConstructionUnavailable extends Error {
    constructor(message:string) {super(message);this.name="AS3ClassConstructionUnavailable";}
}
/** Dynamic Class values use the same registered constructors as direct calls. */
export function as3ConstructClass(value:unknown,args:unknown[]):unknown {
    if (value === null || value === undefined) {
        const error=new TypeError("Error #1007: Instantiation attempted on a non-constructor.");
        Object.defineProperty(error,"errorID",{value:1007});throw error;
    }
    const target=lookupDynamicConstruction(value);
    if (typeof target === "string") {
        const dot=target.lastIndexOf("."),label=dot<0 ? target : target.slice(0,dot)+"::"+target.slice(dot+1);
        const error=new Error(`Error #1001: The method ${label}() is not implemented.`);
        error.name="VerifyError";Object.defineProperty(error,"errorID",{value:1001});throw error;
    }
    if (!target) throw new AS3ClassConstructionUnavailable("Class construction requires an authenticated registered constructor or interface");
    return Reflect.construct(target,args);
}

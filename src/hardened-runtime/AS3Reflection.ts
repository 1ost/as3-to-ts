import { getAS3StaticReflectionDescriptor, authorityStatus, AS3StaticReflectionDescriptor } from "./internal/AS3TypeRegistry";

export interface AS3ReflectionXml {
    readonly variable: AS3ReflectionXmlList;
    select(name: string): AS3ReflectionXmlList;
    attribute(name: string): AS3ReflectionXmlList;
}
export interface AS3ReflectionXmlList extends Iterable<AS3ReflectionXml> {
    length(): number;
    toPropertyKey(): string;
    toString(): string;
}
export interface AS3ReflectionProvider<Metadata> {
    createFlashReflectionMetadata(bindings: readonly {constructor: Function; descriptor: AS3StaticReflectionDescriptor}[]): Metadata;
    describeTypeXml(value: unknown, metadata: Metadata): AS3ReflectionXml;
}
let describeBound: ((value: Function, descriptor: AS3StaticReflectionDescriptor) => AS3ReflectionXml) | null = null;
let installing = false;

/** Compiler's authenticated target wiring installs the shared implementation once. */
export function installAS3ReflectionProvider<Metadata>(value: AS3ReflectionProvider<Metadata>): void {
    if (!authorityStatus().sealed) throw new TypeError("AS3 reflection requires sealed type authority");
    if (describeBound || installing) throw new TypeError("AS3 reflection provider already installed");
    installing = true;
    try {
        const create = value?.createFlashReflectionMetadata;
        const describe = value?.describeTypeXml;
        if (typeof create !== "function" || typeof describe !== "function") throw new TypeError("Invalid AS3 reflection provider");
        const contexts = new WeakMap<Function, Metadata>();
        const pending = new WeakSet<Function>();
        describeBound = (constructor, descriptor) => {
            if (!contexts.has(constructor)) {
                if (pending.has(constructor)) throw new TypeError("Reentrant AS3 reflection binding");
                pending.add(constructor);
                try {
                    const bindings = Object.freeze([Object.freeze({constructor, descriptor})]);
                    contexts.set(constructor, create.call(value, bindings));
                } finally { pending.delete(constructor); }
            }
            return describe.call(value, constructor, contexts.get(constructor)!);
        };
    } finally { installing = false; }
}

export function as3DescribeTypeStatic(value: unknown): AS3ReflectionXml {
    const descriptor = getAS3StaticReflectionDescriptor(value);
    if (!describeBound) throw new TypeError("AS3 reflection requires an authenticated shared provider");
    return describeBound(value as Function, descriptor);
}

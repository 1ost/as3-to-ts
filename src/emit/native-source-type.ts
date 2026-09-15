import Node from '../syntax/node';

const primitiveNames = ['Number', 'int', 'uint', 'Boolean', 'Object', '*', 'String'];

/** Resolve the bounded exact source type surface before any TypeScript remapping. */
export function nativeSourceTypeIdentity(type: Node, qname: string, imports: string[]): string {
    if (!type || !type.text) return '*';
    if (type.qualifiedName) return type.qualifiedName;
    const name = type.text;
    if (name === qname.split('.').pop() && primitiveNames.indexOf(name) >= 0)
        throw new Error('AS3_CLASS_METADATA_UNSUPPORTED: ambiguous unqualified own/builtin type ' + name);
    // Flash type annotations retain these lexical identities ahead of foreign imports.
    if (name === qname.split('.').pop()) return qname;
    if (primitiveNames.indexOf(name) >= 0) return name;
    const explicit = imports.filter(value => value.split('.').pop() === name);
    const unique = explicit.filter((value, index) => explicit.indexOf(value) === index);
    if (unique.length > 1) throw new Error('AS3_CLASS_METADATA_UNSUPPORTED: ambiguous source type import ' + name);
    if (unique.length === 1) return unique[0];
    return name;
}

import Node from '../syntax/node';
import K from '../syntax/nodeKind';

const functions = [K.FUNCTION, K.GET, K.SET, K.LAMBDA];
const builtins = ['Object', 'Array', 'Number', 'String', 'Boolean', 'Function', 'Class', 'int', 'uint'];
export function sourceIdentifier(node: Node, source: string): string {
    // The parser already rewrites int/uint identifier text to Number.
    const spelling = source.slice(node.start, node.end);
    return /^[A-Za-z_$][\w$]*$/.test(spelling) ? spelling : node.text;
}
export function insideTypeOf(node: Node): boolean {
    for (let scope = node.parent; scope; scope = scope.parent) {
        if (scope.kind === K.TYPEOF) return true;
        if (functions.indexOf(scope.kind) >= 0) return false;
    }
    return false;
}
function declared(scope: Node, name: string): boolean {
    let found = false;
    const collect = (node: Node): void => {
        if (node !== scope && functions.indexOf(node.kind) >= 0) {
            const value = node.findChild(K.NAME);
            if (value && value.text === name) found = true;
            return;
        }
        if (node.kind === K.NAME_TYPE_INIT) {
            const value = node.findChild(K.NAME);
            if (value && value.text === name) found = true;
        }
        node.children.forEach(collect);
    };
    collect(scope); return found;
}
/** Resolve source scope before any legacy identifier rewriting. */
export function typeOfBinding(node: Node, source: string, sourceClasses: string[]): 'lexical' | 'class' | 'builtin' | 'literal' | null {
    const name = sourceIdentifier(node, source);
    if (['undefined', 'null', 'true', 'false', 'NaN', 'Infinity', 'this', 'super'].indexOf(name) >= 0) return 'literal';
    for (let scope = node.parent; scope; scope = scope.parent) {
        if (functions.indexOf(scope.kind) >= 0 && declared(scope, name)) return 'lexical';
        if (scope.kind === K.CATCH && scope.findChild(K.NAME).text === name) return 'lexical';
        if (scope.kind === K.CLASS) {
            if (scope.findChild(K.NAME).text === name) return 'class';
            if (scope.findChild(K.CONTENT).children.some(member => {
                if ([K.VAR_LIST, K.CONST_LIST].indexOf(member.kind) >= 0)
                    return member.findChildren(K.NAME_TYPE_INIT).some(field => field.findChild(K.NAME).text === name);
                const value = member.findChild(K.NAME); return value && value.text === name;
            })) return 'lexical';
        }
        if (scope.kind === K.PACKAGE) {
            const namespace = scope.findChild(K.NAME).text, candidates: string[] = [];
            const add = (qname: string): void => {
                if (sourceClasses.indexOf(qname) >= 0 && candidates.indexOf(qname) < 0) candidates.push(qname);
            };
            add((namespace ? namespace + '.' : '') + name);
            scope.findChild(K.CONTENT).findChildren(K.IMPORT).forEach(item => {
                const qname = item.text.endsWith('.*') ? item.text.slice(0, -1) + name : item.text;
                if (qname.split('.').pop() === name) add(qname);
            });
            if (candidates.length > 1) throw new Error('AS3_SOURCE_OPERATION_UNSUPPORTED: ambiguous typeof operand: ' + name);
            if (candidates.length) return 'class';
        }
    }
    return builtins.indexOf(name) >= 0 ? 'builtin' : null;
}
/** Validate names before legacy emission can qualify an unknown name with this. */
export function validateNativeTypeOf(cls: Node, source: string, sourceClasses: string[]): void {
    const operand = (node: Node): void => {
        if (functions.indexOf(node.kind) >= 0 || node.kind === K.TYPE) return;
        if (node.kind === K.IDENTIFIER
            && !(node.parent.kind === K.DOT && node.parent.children[0] !== node)
            && !(node.parent.kind === K.PROP && node.parent.children[0] === node)
            && !typeOfBinding(node, source, sourceClasses))
            throw new Error('AS3_SOURCE_OPERATION_UNSUPPORTED: unresolved typeof operand: ' + sourceIdentifier(node, source));
        node.children.forEach(operand);
    };
    const scan = (node: Node): void => {
        if (node.kind === K.TYPEOF) node.children.forEach(operand);
        node.children.forEach(scan);
    };
    scan(cls);
}

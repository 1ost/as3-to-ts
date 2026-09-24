import Node from '../syntax/node';
import K from '../syntax/nodeKind';

export interface NativePatternLocal {
    readonly owner: string;
    readonly declarationStart: number;
    readonly declarationEnd: number;
    readonly typeStart: number;
    readonly typeEnd: number;
    readonly name: string;
    readonly source: string;
    readonly flags: string;
    readonly calls: ReadonlyArray<number>;
}

/** Scalar replacement of a nonescaping RegExp literal. No RegExp Class token,
 * cast, reference storage or reflection authority is granted by this proof. */
export function nativePatternLocals(cls: Node, owner: string, source: string,
    resolve: (name: string) => string): NativePatternLocal[] {
    if (resolve('RegExp') !== 'RegExp') return [];
    const result: NativePatternLocal[] = [], content = cls.findChild(K.CONTENT);
    if (!content) return result;
    content.findChildren(K.FUNCTION).forEach(method => {
        const body = method.findChild(K.BLOCK);
        if (!body || method.findChild(K.NAME).text === cls.findChild(K.NAME).text) return;
        // Reject even unrelated nested functions: no closure/scope approximation.
        let nested = false;
        const checkNested = (node: Node): void => {
            if (node.kind === K.FUNCTION || node.kind === K.LAMBDA) nested = true;
            node.children.forEach(checkNested);
        };
        checkNested(body);
        if (nested) return;
        body.findChildren(K.VAR_LIST).forEach(statement => statement.findChildren(K.NAME_TYPE_INIT).forEach(decl => {
            const type = decl.findChild(K.TYPE), init = decl.findChild(K.INIT), name = decl.findChild(K.NAME);
            if (!type || type.text !== 'RegExp' || !init || init.children.length !== 1) return;
            const literal = init.children[0], raw = literal.text;
            const match = literal.kind === K.LITERAL && typeof raw === 'string'
                && source.slice(literal.start, literal.start + raw.length) === raw && /^\/([\s\S]+)\/(g?)$/.exec(raw);
            if (!match) return;
            let valid = true;
            const calls: number[] = [];
            const inspect = (node: Node): void => {
                if (node === name) return;
                if (node.text === name.text && (node.kind === K.IDENTIFIER || node.kind === K.NAME || node.kind === K.REST)) {
                    const dot = node.parent, call = dot && dot.parent;
                    const args = call && call.findChild(K.ARGUMENTS);
                    if (node.kind !== K.IDENTIFIER || node.start < literal.start + raw.length
                        || !dot || dot.kind !== K.DOT || dot.children.length !== 2 || dot.children[0] !== node
                        || dot.children[1].kind !== K.LITERAL || dot.children[1].text !== 'test'
                        || !call || call.kind !== K.CALL || call.children[0] !== dot
                        || call.parent && call.parent.kind === K.NEW || !args || args.children.length > 1) valid = false;
                    else calls.push(call.start);
                }
                node.children.forEach(inspect);
            };
            inspect(method);
            // A field/local collision retains the existing lexical lookup hold.
            const collision = content.children.some(member => member !== method && (
                member.findChild(K.NAME) && member.findChild(K.NAME).text === name.text
                || member.findChildren(K.NAME_TYPE_INIT).some(d => d.findChild(K.NAME).text === name.text)));
            if (valid && !collision && calls.length) result.push(Object.freeze({owner,
                declarationStart: decl.start, declarationEnd: Math.max(decl.end,literal.start+raw.length), typeStart: type.start, typeEnd: type.end, name: name.text,
                source: match[1], flags: match[2], calls: Object.freeze(calls)}));
        }));
    });
    return result;
}

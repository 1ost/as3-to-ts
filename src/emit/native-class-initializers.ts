import Node from '../syntax/node';
import NodeKind from '../syntax/nodeKind';

export interface NativeClassInitializationOptions {
    /** Exact source QNames. Lazy entries must all use this compiler contract;
     * ready entries are externally initialized native provider constructors. */
    classes: {[qname: string]: 'lazy' | 'ready'};
}

export class NativeClassInitializers {
    private classes: {[qname: string]: 'lazy' | 'ready'};
    public enabled: boolean;
    public ownNames = new Map<Node, string>();
    public declareName: string;
    public readName: string;

    constructor(root: Node, source: string, options?: NativeClassInitializationOptions) {
        this.enabled = options !== undefined;
        this.classes = options && options.classes || {};
        const fail = (message: string): never => { throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: ' + message); };
        if (this.enabled && (!options || typeof options !== 'object' || Array.isArray(options)
            || Object.keys(options).some(key => key !== 'classes') || !options.classes
            || typeof options.classes !== 'object' || Array.isArray(options.classes)
            || Object.getPrototypeOf(options.classes) !== Object.prototype && Object.getPrototypeOf(options.classes) !== null))
            fail('invalid class initialization configuration');
        Object.keys(this.classes).forEach(qname => {
            if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(qname)
                || ['lazy', 'ready'].indexOf(this.classes[qname]) < 0) fail('invalid class identity: ' + qname);
        });
        let sequence = 0;
        const fresh = (label: string): string => {
            let result: string;
            do { result = '__as3_' + label + '_' + sequence++; } while (source.indexOf(result) >= 0);
            return result;
        };
        this.declareName = fresh('declareClass'); this.readName = fresh('readClass');
        const walk = (node: Node): void => {
            if (!node) return;
            if (node.kind === NodeKind.CLASS_INITIALIZER && !this.enabled) fail('class-body statements require native class initialization');
            if (node.kind === NodeKind.CLASS && this.enabled) {
                const qname = this.packageName(node) + node.findChild(NodeKind.NAME).text;
                if (!Object.prototype.hasOwnProperty.call(this.classes, qname) || this.classes[qname] !== 'lazy')
                    fail('source class must have an exact lazy identity: ' + qname);
                this.ownNames.set(node, fresh('classValue'));
            }
            if (this.enabled && [NodeKind.NAMESPACE_DECLARATION, NodeKind.NAMESPACE_ACCESS, NodeKind.USE,
                NodeKind.EMBED, NodeKind.INCLUDE].indexOf(node.kind) >= 0) fail('namespace/embedded/include initialization requires separate authority');
            if (this.enabled && node.kind === NodeKind.DOT) {
                const qualified = (value: Node): string => value.kind === NodeKind.IDENTIFIER ? value.text
                    : value.kind === NodeKind.DOT && value.children[1].kind === NodeKind.LITERAL
                    ? qualified(value.children[0]) + '.' + value.children[1].text : '';
                const name = qualified(node);
                if (name && Object.prototype.hasOwnProperty.call(this.classes, name))
                    fail('qualified class-value syntax requires separate lowering: ' + name);
            }
            const declaration = node.kind === NodeKind.INIT && node.parent && node.parent.parent;
            const modifiers = declaration && declaration.findChild(NodeKind.MOD_LIST);
            const staticInitializer = modifiers && modifiers.children.some(value => value.text === 'static')
                && declaration.parent && declaration.parent.parent && declaration.parent.parent.kind === NodeKind.CLASS;
            if (this.enabled && (node.kind === NodeKind.CLASS_INITIALIZER || staticInitializer)) {
                const checkStatement = (value: Node): void => {
                    if (!value || value.kind === NodeKind.LAMBDA || value.kind === NodeKind.FUNCTION) return;
                    if ([NodeKind.VAR, NodeKind.CONST, NodeKind.VAR_LIST, NodeKind.CONST_LIST, NodeKind.RETURN].indexOf(value.kind) >= 0
                        || value.kind === NodeKind.IDENTIFIER && ['this', 'super', 'arguments'].indexOf(value.text) >= 0)
                        fail('class-initializer lexical bindings require separate authority');
                    value.children.forEach(checkStatement);
                };
                checkStatement(node);
            }
            node.children.forEach(walk);
        };
        walk(root);
    }

    private packageNode(node: Node): Node {
        for (let value = node; value; value = value.parent) if (value.kind === NodeKind.PACKAGE) return value;
        return null;
    }
    private packageName(node: Node): string {
        const pkg = this.packageNode(node), name = pkg && pkg.findChild(NodeKind.NAME).text;
        return name ? name + '.' : '';
    }
    public resolve(node: Node, name: string): 'lazy' | 'ready' | null {
        if (!this.enabled) return null;
        const candidates: string[] = [];
        const local = this.packageName(node) + name;
        if (Object.prototype.hasOwnProperty.call(this.classes, local)) candidates.push(local);
        const pkg = this.packageNode(node), content = pkg && pkg.findChild(NodeKind.CONTENT);
        if (content) content.findChildren(NodeKind.IMPORT).forEach(value => {
            const qname = value.text.endsWith('.*') ? value.text.slice(0, -1) + name : value.text;
            if (qname.split('.').pop() === name && Object.prototype.hasOwnProperty.call(this.classes, qname)
                && candidates.indexOf(qname) < 0) candidates.push(qname);
        });
        if (candidates.length > 1) throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: ambiguous class identity: ' + name);
        return candidates.length ? this.classes[candidates[0]] : null;
    }
    public resolveQualified(qname: string): 'lazy' | 'ready' | null {
        return Object.prototype.hasOwnProperty.call(this.classes, qname) ? this.classes[qname] : null;
    }
}

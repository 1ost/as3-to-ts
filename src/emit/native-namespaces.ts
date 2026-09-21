import Node, {outerEncapsulatedExpression} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';

export interface NamespaceMember {
    uri: string;
    name: string;
    owner: Node;
    static: boolean;
    declaration: Node;
}

export interface NamespaceAccess {
    qualifier: string;
    uri: string;
    name: string;
    receiver: Node;
    implicitMember: NamespaceMember;
}

/** Compile-time identities only: no AVM interpreter or application runtime. */
export class NativeNamespaces {
    private members = new Map<Node, NamespaceMember>();
    private keys = new Map<string, string>();
    private declarations = new Map<string, Node>();
    private classes = new Map<string, Node[]>();
    private openedAccesses = new Map<Node, NamespaceAccess>();
    private configured: {[qname: string]: string};

    constructor(private root: Node, private source: string, namespaceUris?: {[qname: string]: string}, private proxyEnabled = false) {
        if (namespaceUris !== undefined && (!namespaceUris || typeof namespaceUris !== 'object' || Array.isArray(namespaceUris)))
            this.fail('namespaceUris must be a QName-to-URI object');
        this.configured = namespaceUris || {};
        this.walk(root, node => {
            if (node.kind !== NodeKind.CLASS) return;
            const qname = this.packageName(node) + node.findChild(NodeKind.NAME).text;
            this.classes.set(qname, (this.classes.get(qname) || []).concat(node));
        });
        Object.keys(this.configured).forEach(qname => {
            if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(qname)
                || typeof this.configured[qname] !== 'string' || !this.configured[qname])
                this.fail('invalid namespaceUris entry: ' + qname);
        });
        this.walk(root, node => {
            if (node.kind !== NodeKind.NAMESPACE_DECLARATION) return;
            const mods = node.findChild(NodeKind.MOD_LIST).children;
            if (mods.some(mod => mod.text !== 'public')) this.fail('non-public namespace declaration');
            const qname = this.packageName(node) + node.findChild(NodeKind.NAME).text;
            if (this.declarations.has(qname)) this.fail('duplicate namespace declaration: ' + qname);
            this.declarations.set(qname, node);
        });
        this.declarations.forEach((node, qname) => {
            const uri = this.declarationUri(node, []);
            if (Object.prototype.hasOwnProperty.call(this.configured, qname) && this.configured[qname] !== uri)
                this.fail('configured URI disagrees with source: ' + qname);
        });
        this.walk(root, node => {
            if ([NodeKind.FUNCTION, NodeKind.GET, NodeKind.SET, NodeKind.VAR_LIST, NodeKind.CONST_LIST].indexOf(node.kind) < 0) return;
            const mods = node.findChild(NodeKind.MOD_LIST);
            const qualifier = mods && mods.children.filter(mod =>
                ['public', 'private', 'protected', 'internal', 'static', 'override', 'final', 'native', 'dynamic'].indexOf(mod.text) < 0);
            if (!qualifier || !qualifier.length) return;
            if (qualifier.length !== 1) this.fail('multiple namespace modifiers');
            const owner = this.ancestor(node, NodeKind.CLASS);
            if (!owner || !node.parent || node.parent.kind !== NodeKind.CONTENT)
                this.fail('namespace member outside a class');
            if (node.kind === NodeKind.GET || node.kind === NodeKind.SET)
                this.fail('namespace accessors require separate lowering');
            this.hierarchy(owner);
            if (mods.children.some(mod => mod.text === 'override'))
                this.fail('namespace member overrides require separate lowering');
            if (node.kind === NodeKind.FUNCTION && mods.children.some(mod => mod.text === 'static'))
                this.fail('static namespace method closures require separate lowering');
            const names = [NodeKind.VAR_LIST, NodeKind.CONST_LIST].indexOf(node.kind) >= 0
                ? node.findChildren(NodeKind.NAME_TYPE_INIT).map(value => value.findChild(NodeKind.NAME))
                : [node.findChild(NodeKind.NAME)];
            if (names.length !== 1) this.fail('multiple namespace fields in one declaration');
            const member: NamespaceMember = { uri: this.resolve(node, qualifier[0].text), name: names[0].text,
                owner, static: mods.children.some(mod => mod.text === 'static'), declaration: node };
            this.members.forEach(previous => {
                if (previous.owner === owner && previous.uri === member.uri && previous.name === member.name
                    && previous.static === member.static) this.fail('duplicate namespace member: ' + member.name);
            });
            this.members.set(names[0], member);
        });
        this.members.forEach(member => {
            if (member.static) return;
            this.hierarchy(member.owner).slice(1).forEach(base => {
                if (this.findMember(base, member.uri, member.name, false, true))
                    this.fail('namespace member redeclaration in an inherited class: ' + member.name);
            });
        });
        this.lowerOpenedThisAccesses();
        this.walk(root, node => {
            if (node.kind === NodeKind.USE) this.resolve(node, node.text);
            if (node.kind === NodeKind.NAMESPACE_ACCESS) this.access(node);
        });
        let namespaceSource = this.declarations.size > 0 || this.members.size > 0;
        this.walk(root, node => { if (node.kind === NodeKind.NAMESPACE_ACCESS) namespaceSource = true; });
        if (namespaceSource) this.walk(root, node => {
            if ([NodeKind.E4X_ATTR, NodeKind.E4X_FILTER, NodeKind.E4X_STAR, NodeKind.XML_LITERAL].indexOf(node.kind) >= 0
                || node.kind === NodeKind.IDENTIFIER && ['XML', 'XMLList'].indexOf(node.text) >= 0)
                this.fail('E4X requires separate lowering');
            if (node.kind === NodeKind.NAME && node.text === 'globalThis'
                || node.kind === NodeKind.IMPORT && node.text.split('.').pop() === 'globalThis')
                this.fail('source binding shadows native globalThis');
        });
    }

    fail(message: string): never { throw new Error('AS3_NAMESPACE_UNSUPPORTED: ' + message); }

    private walk(node: Node, visit: (node: Node) => void): void {
        if (!node) return;
        visit(node);
        node.children.forEach(child => this.walk(child, visit));
    }

    private ancestor(node: Node, kind: NodeKind): Node {
        for (let value = node.parent; value; value = value.parent) if (value.kind === kind) return value;
        return null;
    }

    private packageName(node: Node): string {
        const owner = this.ancestor(node, NodeKind.PACKAGE);
        const name = owner && owner.findChild(NodeKind.NAME).text;
        return name ? name + '.' : '';
    }

    /** Only lexical same-file class declarations are inheritance authority. */
    private classType(node: Node, name: string): Node {
        if (!name) return null;
        const matches: Node[] = [];
        this.candidates(node, name).forEach(qname => {
            (this.classes.get(qname) || []).forEach(value => {
                if (matches.indexOf(value) < 0) matches.push(value);
            });
        });
        if (matches.length > 1) this.fail('ambiguous namespace receiver/base class: ' + name);
        return matches[0] || null;
    }

    private hierarchy(owner: Node, active: Node[] = []): Node[] {
        if (!owner) return [];
        if (active.indexOf(owner) >= 0) this.fail('cyclic namespace class inheritance');
        const mods = owner.findChild(NodeKind.MOD_LIST);
        if (mods && mods.children.some(mod => mod.text === 'dynamic'))
            this.fail('dynamic namespace receiver classes require separate lowering');
        const extension = owner.findChild(NodeKind.EXTENDS);
        if (!extension) return [owner];
        const baseName = extension.text;
        const base = this.classType(owner, baseName);
        if (!base) {
            const pkg = this.ancestor(owner, NodeKind.PACKAGE);
            const importedProxy = pkg && pkg.findChild(NodeKind.CONTENT).findChildren(NodeKind.IMPORT)
                .some(item => item.text === 'flash.utils.Proxy' && baseName === 'Proxy');
            if (this.proxyEnabled && importedProxy) return [owner];
            this.fail('namespace inheritance requires a proven same-file ordinary base: ' + baseName);
        }
        if (base.start > owner.start)
            this.fail('forward namespace base declaration requires class scheduling: ' + baseName);
        return [owner].concat(this.hierarchy(base, active.concat(owner)));
    }

    private findMember(owner: Node, uri: string, name: string, isStatic: boolean, ownOnly = false): NamespaceMember {
        const owners = ownOnly || isStatic ? [owner] : this.hierarchy(owner);
        for (const candidate of owners) {
            let found: NamespaceMember = null;
            this.members.forEach(member => {
                if (member.owner === candidate && member.uri === uri && member.name === name && member.static === isStatic)
                    found = member;
            });
            if (found) return found;
        }
        return null;
    }

    private candidates(node: Node, name: string): string[] {
        if (name.indexOf('.') >= 0) return [name];
        const owner = this.ancestor(node, NodeKind.PACKAGE);
        const imports = owner ? owner.findChild(NodeKind.CONTENT).findChildren(NodeKind.IMPORT) : [];
        const explicit = imports.filter(value => value.text.split('.').pop() === name).map(value => value.text);
        if (explicit.length > 1 && explicit.some(value => value !== explicit[0])) this.fail('ambiguous namespace import: ' + name);
        if (explicit.length) return explicit;
        return [this.packageName(node) + name].concat(imports.filter(value => /\.\*$/.test(value.text))
            .map(value => value.text.slice(0, -1) + name));
    }

    private lookup(node: Node, name: string): string {
        const matches = this.candidates(node, name).filter(qname => this.declarations.has(qname)
            || Object.prototype.hasOwnProperty.call(this.configured, qname)
            || this.proxyEnabled && qname === 'flash.utils.flash_proxy');
        if (matches.length !== 1) this.fail('unresolved or ambiguous namespace: ' + name);
        return matches[0];
    }

    resolve(node: Node, name: string): string {
        const qname = this.lookup(node, name);
        const declaration = this.declarations.get(qname);
        return declaration ? this.declarationUri(declaration, []) : qname === 'flash.utils.flash_proxy'
            ? 'http://www.adobe.com/2006/actionscript/flash/proxy' : this.configured[qname];
    }

    declarationUri(node: Node, active: Node[]): string {
        if (active.indexOf(node) >= 0) this.fail('cyclic namespace alias');
        const value = node.children[2];
        if (value.kind === NodeKind.LITERAL) {
            const literal = /^(["'])([^\\\r\n]*)\1$/.exec(value.text);
            if (!literal || !literal[2]) this.fail('namespace URI must be a nonempty unescaped literal');
            return literal[2];
        }
        if (value.kind !== NodeKind.IDENTIFIER) this.fail('dynamic namespace declaration');
        const qname = this.lookup(node, value.text);
        const declaration = this.declarations.get(qname);
        return declaration ? this.declarationUri(declaration, active.concat(node)) : this.configured[qname];
    }

    member(name: Node): NamespaceMember { return this.members.get(name); }

    memberDeclaration(node: Node): boolean {
        let found = false;
        this.members.forEach(member => { if (member.declaration === node) found = true; });
        return found;
    }

    access(node: Node): NamespaceAccess {
        const reference = outerEncapsulatedExpression(node);
        if (reference.parent && [NodeKind.DELETE, NodeKind.PRE_INC, NodeKind.POST_INC, NodeKind.PRE_DEC, NodeKind.POST_DEC].indexOf(reference.parent.kind) >= 0)
            this.fail('namespace delete/update requires separate lowering');
        const opened = this.openedAccesses.get(node);
        if (opened) return opened;
        const left = node.children[0];
        let qualifier: string;
        let receiver: Node = null;
        if (left.kind === NodeKind.IDENTIFIER) qualifier = left.text;
        else if (left.kind === NodeKind.DOT && left.children[1].kind === NodeKind.LITERAL) {
            qualifier = left.children[1].text;
            receiver = left.children[0];
        } else this.fail('dynamic namespace selector');
        const uri = this.resolve(node, qualifier);
        const name = node.children[1].text;
        let implicitMember: NamespaceMember = null;
        if (!receiver) {
            const owner = this.ancestor(node, NodeKind.CLASS);
            const instanceMember = this.findMember(owner, uri, name, false);
            const staticMember = this.findMember(owner, uri, name, true);
            if (instanceMember && staticMember) this.fail('ambiguous implicit namespace receiver');
            implicitMember = instanceMember || staticMember;
            if (!implicitMember) this.fail('implicit namespace receiver requires a proven member: ' + name);
        } else if (receiver.kind === NodeKind.IDENTIFIER) {
            const owner = this.ancestor(node, NodeKind.CLASS);
            if (owner && (receiver.text === 'this' || receiver.text === owner.findChild(NodeKind.NAME).text)) {
                if (!this.findMember(owner, uri, name, receiver.text !== 'this'))
                    this.fail('qualified receiver requires a proven namespace member: ' + name);
            }
        }
        return { uri, name, receiver, implicitMember, qualifier };
    }

    /** Resolve only a direct instance receiver with a complete lexical namespace set.
     * Preserve the original span/children so existing selector coercion and write
     * guards handle the operation; no text replacement or public-name aliasing. */
    private lowerOpenedThisAccesses(): void {
        this.walk(this.root, node => {
            if (node.kind !== NodeKind.DOT || node.children.length !== 2
                || node.children[0].kind !== NodeKind.IDENTIFIER || node.children[0].text !== 'this') return;
            const owner = this.ancestor(node, NodeKind.CLASS);
            if (!owner) return;
            const name = node.children[1].text;
            if (!Array.from(this.members.values()).some(member => member.name === name && !member.static)) return;
            const pkg = this.ancestor(node, NodeKind.PACKAGE);
            const opened = (pkg ? pkg.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE) : [])
                .concat(owner.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE));
            const candidates: {member: NamespaceMember; qualifier: string}[] = [];
            opened.forEach(directive => {
                const uri = this.resolve(directive, directive.text), member = this.findMember(owner, uri, name, false);
                if (member && !candidates.some(value => value.member === member))
                    candidates.push({member, qualifier:directive.text});
            });
            if (!candidates.length) return;
            if (candidates.length !== 1) this.fail('ambiguous open namespace member: ' + name);
            for (let scope = node.parent; scope && scope !== owner; scope = scope.parent) {
                if ([NodeKind.FUNCTION,NodeKind.GET,NodeKind.SET,NodeKind.LAMBDA].indexOf(scope.kind) >= 0) {
                    const mods = scope.findChild(NodeKind.MOD_LIST);
                    if (scope.parent !== owner.findChild(NodeKind.CONTENT)
                        || mods && mods.children.some(mod => mod.text === 'static'))
                        this.fail('open namespace this requires an instance member receiver');
                }
                if (scope.findChildren(NodeKind.USE).length)
                    this.fail('function-local open namespaces require separate resolution');
            }
            for (const cls of this.hierarchy(owner)) {
                for (const declaration of cls.findChild(NodeKind.CONTENT).children) {
                    if (this.memberDeclaration(declaration)) continue;
                    const names = [NodeKind.VAR_LIST,NodeKind.CONST_LIST].indexOf(declaration.kind) >= 0
                        ? declaration.findChildren(NodeKind.NAME_TYPE_INIT).map(value => value.findChild(NodeKind.NAME))
                        : [declaration.findChild(NodeKind.NAME)];
                    if (names.some(value => value && value.text === name))
                        this.fail('open namespace spelling collides with an ordinary member: ' + name);
                }
            }
            const selected = candidates[0];
            this.openedAccesses.set(node, {uri:selected.member.uri, name, receiver:node.children[0],
                implicitMember:null, qualifier:selected.qualifier});
            node.kind = NodeKind.NAMESPACE_ACCESS;
        });
    }

    ownAccessMember(node: Node): NamespaceMember {
        const access = this.access(node);
        if (access.implicitMember) return access.implicitMember;
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (!owner || access.receiver.kind !== NodeKind.IDENTIFIER) return null;
        const receiver = access.receiver.text;
        if (receiver !== 'this' && receiver !== owner.findChild(NodeKind.NAME).text) return null;
        return this.findMember(owner, access.uri, access.name, receiver !== 'this');
    }

    accessMember(node: Node, receiverType: string): NamespaceMember {
        const own = this.ownAccessMember(node);
        if (own) return own;
        const access = this.access(node);
        const receiverClass = this.classType(node, receiverType);
        return receiverClass && this.findMember(receiverClass, access.uri, access.name, false);
    }

    checkReceiver(node: Node, receiverType: string): void {
        const access = this.access(node);
        if (!access.receiver) return;
        const receiver = access.receiver;
        if (receiver.kind !== NodeKind.IDENTIFIER)
            this.fail('complex namespace receiver requires type-directed lowering');
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (owner && (receiver.text === 'this' || receiver.text === owner.findChild(NodeKind.NAME).text)) return;
        const receiverClass = this.classType(node, receiverType);
        if (!receiverClass || !this.findMember(receiverClass, access.uri, access.name, false))
            this.fail('namespace receiver type is not a proven ordinary class: ' + receiver.text);
    }

    checkDot(node: Node): void {
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (!owner) return;
        const name = node.children[1].text;
        if (!Array.from(this.members.values()).some(member => member.name === name)) return;
        const owners = this.hierarchy(owner);
        this.members.forEach(member => {
            if (owners.indexOf(member.owner) < 0 || member.name !== name) return;
            const pkg = this.ancestor(node, NodeKind.PACKAGE);
            const opened = (pkg ? pkg.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE) : [])
                .concat(owner.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE));
            if (opened.some(directive => this.resolve(directive, directive.text) === member.uri))
                this.fail('open namespace member requires explicit selector: ' + name);
        });
    }

    /** Reject erased namespace value uses and implicit own-member resolution. */
    checkIdentifier(node: Node, isLocal: boolean): void {
        if (isLocal) return;
        const namespaceMatches = this.candidates(node, node.text).filter(qname => this.declarations.has(qname)
            || Object.prototype.hasOwnProperty.call(this.configured, qname));
        if (namespaceMatches.length) this.fail('runtime Namespace values are not lowered: ' + node.text);
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (!Array.from(this.members.values()).some(member => member.name === node.text)) return;
        const owners = owner ? this.hierarchy(owner) : [];
        this.members.forEach(member => {
            if (owners.indexOf(member.owner) >= 0 && member.name === node.text)
                this.fail('implicit namespace member requires an explicit selector: ' + node.text);
        });
    }

    key(uri: string, name: string): string {
        const identity = JSON.stringify([uri, name]);
        let key = this.keys.get(identity);
        if (!key) {
            let index = this.keys.size;
            do { key = '__as3_namespace_member_' + index++; }
            while (this.source.indexOf(key) >= 0 || Array.from(this.keys.values()).indexOf(key) >= 0);
            this.keys.set(identity, key);
        }
        return key;
    }

    keyDeclarations(): string {
        let output = '';
        this.keys.forEach((key, identity) => {
            output += 'const ' + key + ' = globalThis.Symbol.for(' + JSON.stringify('as3.namespace.member@1:' + identity) + ');\n';
        });
        return output;
    }
}

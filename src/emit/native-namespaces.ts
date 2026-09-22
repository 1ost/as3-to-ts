import Node, {createNode, outerEncapsulatedExpression} from '../syntax/node';
import NodeKind from '../syntax/nodeKind';
import {NativeSourceAncestryPlan} from './native-source-ancestry';

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
    private completeDynamicClasses = new Set<Node>();
    private openedAccesses = new Map<Node, NamespaceAccess>();
    private configured: {[qname: string]: string};

    constructor(private root: Node, private source: string, namespaceUris?: {[qname: string]: string}, private proxyEnabled = false,
        private ancestry?: NativeSourceAncestryPlan) {
        if (namespaceUris !== undefined && (!namespaceUris || typeof namespaceUris !== 'object' || Array.isArray(namespaceUris)))
            this.fail('namespaceUris must be a QName-to-URI object');
        this.configured = namespaceUris || {};
        this.walk(root, node => {
            if ([NodeKind.CLASS, NodeKind.INTERFACE].indexOf(node.kind) < 0) return;
            const qname = this.packageName(node) + node.findChild(NodeKind.NAME).text;
            this.classes.set(qname, (this.classes.get(qname) || []).concat(node));
        });
        this.installAncestry();
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
            this.hierarchy(owner);
            const overridden = mods.children.some(mod => mod.text === 'override');
            const names = [NodeKind.VAR_LIST, NodeKind.CONST_LIST].indexOf(node.kind) >= 0
                ? node.findChildren(NodeKind.NAME_TYPE_INIT).map(value => value.findChild(NodeKind.NAME))
                : [node.findChild(NodeKind.NAME)];
            if (names.length !== 1) this.fail('multiple namespace fields in one declaration');
            const member: NamespaceMember = { uri: this.resolve(node, qualifier[0].text), name: names[0].text,
                owner, static: mods.children.some(mod => mod.text === 'static'), declaration: node };
            if (overridden) {
                if ([NodeKind.FUNCTION, NodeKind.GET, NodeKind.SET].indexOf(node.kind) < 0)
                    this.fail('namespace field overrides require separate lowering');
                const base = this.hierarchy(owner).slice(1).map(candidate =>
                    this.findMember(candidate, member.uri, member.name, member.static, true)).find(value => !!value);
                if (!base || base.declaration.kind !== node.kind)
                    this.fail('namespace override requires a matching inherited member: ' + member.name);
            }
            this.members.forEach(previous => {
                if (previous.owner === owner && previous.uri === member.uri && previous.name === member.name
                    && previous.static === member.static) {
                    const accessorPair = [NodeKind.GET, NodeKind.SET].indexOf(previous.declaration.kind) >= 0
                        && [NodeKind.GET, NodeKind.SET].indexOf(member.declaration.kind) >= 0
                        && previous.declaration.kind !== member.declaration.kind;
                    if (!accessorPair) this.fail('duplicate namespace member: ' + member.name);
                }
            });
            this.members.set(names[0], member);
        });
        this.members.forEach(member => {
            if (member.static) return;
            this.hierarchy(member.owner).slice(1).forEach(base => {
                if (!this.isOverride(member) && this.findMember(base, member.uri, member.name, false, true))
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

    private installAncestry(): void {
        if (!this.ancestry || !this.ancestry.classes) return;
        Object.keys(this.ancestry.classes).sort().forEach(qname => {
            if (this.classes.has(qname)) return;
            const metadata = this.ancestry.classes[qname], name = qname.split('.').pop();
            const modifiers = metadata.dynamic
                ? createNode(NodeKind.MOD_LIST, {}, createNode(NodeKind.MODIFIER, {text:'dynamic'}))
                : createNode(NodeKind.MOD_LIST, {});
            const uses = (metadata.uses || []).map(qname => createNode(NodeKind.USE, {text:qname}));
            const children: Node[] = [createNode(NodeKind.NAME, {text:name}), modifiers];
            if (metadata.base) children.push(createNode(NodeKind.EXTENDS, {text:metadata.base}));
            children.push(createNode(NodeKind.CONTENT, {}, ...uses));
            const owner = createNode(NodeKind.CLASS, {qualifiedName:qname}, ...children);
            this.classes.set(qname, [owner]);
            if (metadata.namespaceComplete) this.completeDynamicClasses.add(owner);
            metadata.members.forEach(member => {
                const modifiers: Node[] = [createNode(NodeKind.MODIFIER, {text:member.uri})];
                if (member.static) modifiers.push(createNode(NodeKind.MODIFIER, {text:'static'}));
                if (member.override) modifiers.push(createNode(NodeKind.MODIFIER, {text:'override'}));
                const declaration = createNode(member.kind, {}, createNode(NodeKind.MOD_LIST, {}, ...modifiers),
                    createNode(NodeKind.NAME, {text:member.name}));
                this.members.set(declaration.findChild(NodeKind.NAME), {uri:member.uri, name:member.name,
                    owner, static:member.static, declaration});
            });
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
        if (node.qualifiedName) {
            const split = node.qualifiedName.split('.');
            split.pop();
            return split.length ? split.join('.') + '.' : '';
        }
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
        if (mods && mods.children.some(mod => mod.text === 'dynamic') && !this.completeDynamicClasses.has(owner))
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
        // Source-backed ancestry installs related classes as synthetic nodes in
        // a single-file emission. Their source positions are intentionally -1;
        // only two parsed nodes can establish an in-file declaration order.
        if (base.start >= 0 && owner.start >= 0 && base.start > owner.start)
            this.fail('forward namespace base declaration requires class scheduling: ' + baseName);
        return [owner].concat(this.hierarchy(base, active.concat(owner)));
    }

    private findMember(owner: Node, uri: string, name: string, isStatic: boolean, ownOnly = false,
        inheritStatic = false): NamespaceMember {
        const owners = ownOnly || isStatic && !inheritStatic ? [owner] : this.hierarchy(owner);
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
        // A compilation unit may contain a second top-level class after the
        // package block.  Its imports live on the root CONTENT node rather
        // than under a PACKAGE, but they still govern that class's namespace
        // resolution (for example TLF's HostFormatHelper).  Keep package
        // imports preferred and use the enclosing CONTENT imports only for
        // declarations outside a package.
        const content = owner ? owner.findChild(NodeKind.CONTENT)
            : this.root.findChildren(NodeKind.CONTENT)[0];
        const imports = content ? content.findChildren(NodeKind.IMPORT) : [];
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

    private isOverride(member: NamespaceMember): boolean {
        const mods = member.declaration.findChild(NodeKind.MOD_LIST);
        return !!mods && mods.children.some(mod => mod.text === 'override');
    }

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

    /** Lower a dot access whose typed receiver resolves an opened namespace member. */
    lowerOpenedAccess(node: Node, receiverType: string): boolean {
        if (!node || node.kind !== NodeKind.DOT || node.children.length !== 2) return false;
        const owner = this.ancestor(node, NodeKind.CLASS);
        receiverType = receiverType || this.receiverType(node);
        if (node.children[0].kind !== NodeKind.IDENTIFIER && !receiverType) return false;
        const receiverClass = this.classType(node, receiverType);
        if (!owner || !receiverClass) return false;
        const name = node.children[1].text;
        const staticReceiver = this.isClassReceiver(node, receiverClass);
        const pkg = this.ancestor(node, NodeKind.PACKAGE);
        const opened = (pkg ? pkg.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE) : [])
            .concat(owner.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE));
        try {
            this.hierarchy(owner).slice(1).forEach(base => {
                const content = base.findChild(NodeKind.CONTENT);
                if (content) opened.push(...content.findChildren(NodeKind.USE));
            });
        } catch (_) {
            // Keep the existing fail-closed ancestry diagnostic when an
            // actual namespace member needs the base; an unrelated identifier
            // must not make ordinary provider inheritance fail earlier.
        }
        const candidates: {member: NamespaceMember; qualifier: string}[] = [];
        opened.forEach(directive => {
            const uri = this.resolve(directive, directive.text);
            const member = this.findMember(receiverClass, uri, name, staticReceiver);
            if (member && !candidates.some(value => value.member === member))
                candidates.push({member, qualifier:directive.text});
        });
        if (!candidates.length) return false;
        if (candidates.length !== 1) this.fail('ambiguous open namespace member: ' + name);
        const selected = candidates[0];
        this.openedAccesses.set(node, {uri:selected.member.uri, name,
            receiver:node.children[0], implicitMember:null, qualifier:selected.qualifier});
        node.kind = NodeKind.NAMESPACE_ACCESS;
        return true;
    }

    /** Resolve an unqualified identifier opened by a package/class use directive. */
    openedIdentifier(node: Node, isLocal: boolean): NamespaceMember {
        if (isLocal || !node || node.kind !== NodeKind.IDENTIFIER) return null;
        if (node.parent && node.parent.kind === NodeKind.DOT && node.parent.children[1] === node) return null;
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (!owner) return null;
        const pkg = this.ancestor(node, NodeKind.PACKAGE);
        const opened = (pkg ? pkg.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE) : [])
            .concat(owner.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE));
        try {
            this.hierarchy(owner).slice(1).forEach(base => {
                const content = base.findChild(NodeKind.CONTENT);
                if (content) opened.push(...content.findChildren(NodeKind.USE));
            });
        } catch (_) {
            // See openedIdentifier: do not turn unrelated typed dots into an
            // ancestry error before a namespace member is proven.
        }
        for (let scope = node.parent; scope && scope !== owner; scope = scope.parent) {
            if (scope.findChildren(NodeKind.USE).length)
                this.fail('function-local open namespaces require separate resolution');
        }
        const candidates: NamespaceMember[] = [];
        opened.forEach(directive => {
            const uri = this.resolve(directive, directive.text);
            const instance = this.findMember(owner, uri, node.text, false);
            const staticMember = this.findMember(owner, uri, node.text, true, false, true);
            [instance, staticMember].forEach(member => {
                if (member && candidates.indexOf(member) < 0) candidates.push(member);
            });
        });
        if (candidates.length > 1) this.fail('ambiguous open namespace member: ' + node.text);
        const member = candidates[0];
        if (!member) return null;
        for (let scope = node.parent; scope && scope !== owner; scope = scope.parent) {
            if ([NodeKind.FUNCTION, NodeKind.GET, NodeKind.SET, NodeKind.LAMBDA].indexOf(scope.kind) >= 0) {
                const mods = scope.findChild(NodeKind.MOD_LIST);
                if (!member.static && mods && mods.children.some(mod => mod.text === 'static'))
                    this.fail('open namespace implicit member requires an instance member receiver');
            }
        }
        for (const cls of this.hierarchy(owner)) {
            for (const declaration of cls.findChild(NodeKind.CONTENT).children) {
                if (this.memberDeclaration(declaration)) continue;
                const names = [NodeKind.VAR_LIST, NodeKind.CONST_LIST].indexOf(declaration.kind) >= 0
                    ? declaration.findChildren(NodeKind.NAME_TYPE_INIT).map(value => value.findChild(NodeKind.NAME))
                    : [declaration.findChild(NodeKind.NAME)];
                if (names.some(value => value && value.text === node.text)) return null;
            }
        }
        return member;
    }

    accessMember(node: Node, receiverType: string): NamespaceMember {
        const own = this.ownAccessMember(node);
        if (own) return own;
        const access = this.access(node);
        receiverType = receiverType || this.receiverType(node);
        const receiverClass = this.receiverClass(node, receiverType);
        const staticReceiver = receiverClass && this.isClassReceiver(node, receiverClass);
        return receiverClass && this.findMember(receiverClass, access.uri, access.name, staticReceiver);
    }

    /** Infer a source-backed receiver type for a field or class identifier. */
    receiverType(node: Node): string {
        const receiver = node && node.kind === NodeKind.DOT ? node.children[0]
            : node && node.kind === NodeKind.NAMESPACE_ACCESS ? this.access(node).receiver : null;
        if (!receiver) return null;
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (!owner) return null;
        const ownerName = owner.findChild(NodeKind.NAME).text;
        let fieldName: string = null;
        if (receiver.kind === NodeKind.IDENTIFIER) {
            if (receiver.text === 'this' || receiver.text === ownerName) return ownerName;
            if (this.classType(node, receiver.text)) return receiver.text;
            fieldName = receiver.text;
        } else if (receiver.kind === NodeKind.ENCAPSULATED && receiver.children.length === 1
            && receiver.children[0].kind === NodeKind.RELATION && receiver.children[0].children.length >= 3
            && receiver.children[0].children[1].kind === NodeKind.AS
            && receiver.children[0].children[2].kind === NodeKind.IDENTIFIER) {
            // An explicit AS3 cast is authenticated type authority for a
            // namespace-bearing member on the cast target.
            return receiver.children[0].children[2].text;
        } else if (receiver.kind === NodeKind.DOT && receiver.children.length === 2
            && receiver.children[0].kind === NodeKind.IDENTIFIER
            && (receiver.children[0].text === 'this' || receiver.children[0].text === ownerName)
            && receiver.children[1].kind === NodeKind.LITERAL) {
            // Resolve one source-backed field hop for ordinary receiver dots
            // such as this._flowComposer.updateLengths().
            fieldName = receiver.children[1].text;
        } else return null;
        let classes: Node[];
        try { classes = this.hierarchy(owner); } catch (_) { return null; }
        for (const cls of classes) {
            const content = cls.findChild(NodeKind.CONTENT);
            if (!content) continue;
            for (const declaration of content.children) {
                if ([NodeKind.VAR_LIST, NodeKind.CONST_LIST].indexOf(declaration.kind) < 0) continue;
                for (const field of declaration.findChildren(NodeKind.NAME_TYPE_INIT)) {
                    const name = field.findChild(NodeKind.NAME), type = field.findChild(NodeKind.TYPE);
                    if (name && type && name.text === fieldName) return type.qualifiedName || type.text;
                }
            }
        }
        return null;
    }

    private isClassReceiver(node: Node, receiverClass: Node): boolean {
        const receiver = node.kind === NodeKind.DOT ? node.children[0] : this.access(node).receiver;
        if (!receiver || receiver.kind !== NodeKind.IDENTIFIER || !receiverClass) return false;
        return receiver.text === receiverClass.findChild(NodeKind.NAME).text;
    }

    private receiverClass(node: Node, receiverType: string): Node {
        const access = this.access(node), receiver = access.receiver;
        if (receiver && receiver.kind === NodeKind.IDENTIFIER && receiver.text === 'super') {
            const owner = this.ancestor(node, NodeKind.CLASS);
            return owner && this.hierarchy(owner)[1] || null;
        }
        return this.classType(node, receiverType);
    }

    checkReceiver(node: Node, receiverType: string): void {
        const access = this.access(node);
        if (!access.receiver) return;
        const receiver = access.receiver;
        if (receiver.kind !== NodeKind.IDENTIFIER) {
            receiverType = receiverType || this.receiverType(node);
            const receiverClass = this.receiverClass(node, receiverType);
            const staticReceiver = receiverClass && this.isClassReceiver(node, receiverClass);
            if (!receiverClass || !this.findMember(receiverClass, access.uri, access.name, staticReceiver))
                this.fail('complex namespace receiver requires type-directed lowering');
            return;
        }
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (owner && (receiver.text === 'this' || receiver.text === owner.findChild(NodeKind.NAME).text)) return;
        receiverType = receiverType || this.receiverType(node);
        const receiverClass = this.receiverClass(node, receiverType);
        const staticReceiver = receiverClass && this.isClassReceiver(node, receiverClass);
        if (!receiverClass || !this.findMember(receiverClass, access.uri, access.name, staticReceiver))
            this.fail('namespace receiver type is not a proven ordinary class: ' + receiver.text);
    }

    checkDot(node: Node, receiverType?: string): void {
        const owner = this.ancestor(node, NodeKind.CLASS);
        if (!owner) return;
        const name = node.children[1].text;
        if (!Array.from(this.members.values()).some(member => member.name === name)) return;
        const receiverClass = receiverType && this.classType(node, receiverType);
        const staticReceiver = receiverClass && this.isClassReceiver(node, receiverClass);
        const owners = this.hierarchy(owner);
        this.members.forEach(member => {
            if (owners.indexOf(member.owner) < 0 || member.name !== name) return;
            const pkg = this.ancestor(node, NodeKind.PACKAGE);
            const opened = (pkg ? pkg.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE) : [])
                .concat(owner.findChild(NodeKind.CONTENT).findChildren(NodeKind.USE));
            if (opened.some(directive => this.resolve(directive, directive.text) === member.uri)) {
                // A typed ordinary receiver can legally have the same public
                // spelling. Only reject the dot when that receiver itself has
                // a matching namespace member; dynamic receivers remain
                // fail-closed.
                if (receiverClass) {
                    let receiverMember: NamespaceMember = null;
                    try { receiverMember = this.findMember(receiverClass, member.uri, name, staticReceiver); }
                    catch (_) { receiverMember = null; }
                    if (!receiverMember) return;
                }
                this.fail('open namespace member requires explicit selector: ' + name);
            }
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

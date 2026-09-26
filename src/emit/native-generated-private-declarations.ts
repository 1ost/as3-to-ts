import K from '../syntax/nodeKind';
import {NativeSourceUnit, NativeSourceUnitDeclaration, nativeSourceUnitAst, nativeSourceUnitResolver, nativeSourceUnitReferences} from './native-source-unit';

export interface NativeGeneratedPrivateDeclarationBinding {
    /** Compiler-internal key; deliberately not a valid public QName. */
    readonly identity: string;
    readonly declaration: NativeSourceUnitDeclaration;
    readonly base: string | NativeSourceUnitDeclaration | null;
    readonly interfaces: ReadonlyArray<string>;
    readonly tokenExport: string;
    readonly publishExport: string;
    readonly lexicalExport: string;
}
export interface NativeGeneratedPrivateReference {
    readonly owner: string;
    readonly start: number;
    readonly end: number;
    readonly spelling: string;
    readonly identity: string | NativeSourceUnitDeclaration;
}
function fail(reason: string): never {throw new Error('AS3_GENERATED_DECLARATIONS_UNSUPPORTED: ' + reason);}
export function privateDeclarationIdentity(declaration: NativeSourceUnitDeclaration): string {
    return declaration.sourceOwner + '#file:' + declaration.name;
}
/** Header planning only. No public script entry or Class initializer is created. */
export function planNativePrivateDeclarations(units: Map<string, NativeSourceUnit>, known: (name: string) => boolean):
    {bindings: ReadonlyArray<NativeGeneratedPrivateDeclarationBinding>; references: ReadonlyArray<NativeGeneratedPrivateReference>} {
    const bindings: NativeGeneratedPrivateDeclarationBinding[] = [], references: NativeGeneratedPrivateReference[] = [];
    units.forEach(unit => {
        const ast = nativeSourceUnitAst(unit);
        ast.declarations.filter(item => item.declaration.filePrivate).forEach(item => {
            const declaration = item.declaration;
            if (declaration.kind !== 'class') fail('file-private interface emission requires qualification');
            const node = item.node;
            const ext = node.findChild(K.EXTENDS), resolve = nativeSourceUnitResolver(unit, declaration, known);
            const implemented = node.findChild(K.IMPLEMENTS_LIST);
            const interfaces = implemented ? implemented.children.map(item => {
                const identity = resolve(item.qualifiedName || item.text);
                if (typeof identity !== 'string') fail('file-private interface identity requires qualification: ' + unit.owner + ':' + declaration.name);
                return identity as string;
            }) : [];
            if (new Set(interfaces).size !== interfaces.length) fail('duplicate file-private implements declaration: ' + unit.owner + ':' + declaration.name);
            const base = ext ? resolve(ext.qualifiedName || ext.text) : 'Object';
            if (typeof base !== 'string' && base.kind !== 'class') fail('file-private base must be a source class');
            const identity = privateDeclarationIdentity(declaration);
            const index = bindings.length;
            bindings.push(Object.freeze({identity, declaration, base: base === 'Object' ? null : base, interfaces: Object.freeze(interfaces),
                tokenExport: 'privateType' + index, publishExport: 'privatePublish' + index, lexicalExport: 'privateLexical' + index}));
            nativeSourceUnitReferences(unit, declaration, known).forEach(reference => references.push(Object.freeze({
                owner: identity, start: reference.start, end: reference.end, spelling: reference.spelling, identity: reference.identity
            })));
        });
    });
    return {bindings: Object.freeze(bindings), references: Object.freeze(references)};
}

// Host observation adapter; all subject classes/interfaces come from unchanged AIR sources.
import { ApplicationDomain } from '@FLASH@/system/ApplicationDomain';
import { AS3Interface } from '@FLASH@/utils/AS3Interface';
import { as3Is, as3As } from '@FLASH@/utils/AS3Type';
import { as3AsClass, as3CallClass, as3ConstructClass } from '@FLASH@/utils/AS3Class';
import { as3TypeOf } from '@FLASH@/utils/AS3TypeOf';
import { getQualifiedClassName } from '@FLASH@/utils/getQualifiedClassName';
import { getQualifiedSuperclassName } from '@FLASH@/utils/getQualifiedSuperclassName';
import { NativeSourceClassModule, createNativeSourceClassLoadingSession } from '@FLASH@/utils/NativeSourceClassLoadingSession';

export async function run(parentModule: NativeSourceClassModule, childModule: NativeSourceClassModule) {
    const rows: { id: string; value: unknown }[] = [], checks: string[] = [];
    let mode = 0;
    const row = (id: string, value: unknown) => rows.push({ id: `mode-${mode}-${id}`, value });
    const check = (name: string, ok: boolean) => { if (!ok) throw Error(name); checks.push(name); };
    const errorRow = (id: string, fn: () => unknown) => { try { fn(); row(id, 'returned'); } catch (e) { row(id, [e instanceof Error, (e as any).errorID]); } };
    const root = ApplicationDomain.currentDomain;
    const parentSession = createNativeSourceClassLoadingSession({resolve: () => parentModule, maxModules: 1});
    const parentLoaded = await parentSession.load('parent', root);
    const IRoot = parentLoaded.getDefinition('shared.IRoot') as AS3Interface<unknown>;
    const IValue = parentLoaded.getDefinition('shared.IValue') as AS3Interface<unknown>;
    const Parent = parentLoaded.getDefinition('shared.Parent') as Function;
    const parent = Reflect.construct(Parent, []);
    row('interface-value', [as3AsClass(IValue) !== null, as3Is(IValue, Function), as3TypeOf(IValue), as3AsClass(IValue) === IValue, as3AsClass(IRoot) !== null]);
    row('interface-name', [getQualifiedClassName(IValue), getQualifiedSuperclassName(IValue)]);
    row('parent-header', [root.hasDefinition('shared.IValue'), root.getDefinition('shared.IValue') === IValue, root.getQualifiedDefinitionNames().includes('shared::IValue')]);
    row('class-is-interface', [as3Is(IValue, IValue), as3Is(IValue, IRoot), as3Is(IRoot, IValue), as3As(IValue, IValue), as3As(IRoot, IValue)]);
    row('parent-instance', [as3Is(parent, IValue), as3Is(parent, IRoot), as3CallClass(IValue, [parent]) === parent, as3CallClass(IRoot, [parent]) === parent]);
    row('null-cast', [as3CallClass(IValue, [null]), as3CallClass(IValue, [undefined]), as3CallClass(IValue, [null]), as3CallClass(IValue, [undefined])]);
    errorRow('bad-cast', () => as3CallClass(IValue, [{}])); errorRow('missing-cast', () => as3CallClass(IValue));
    errorRow('extra-cast', () => as3CallClass(IValue, [parent, {}])); errorRow('construct', () => as3ConstructClass(IValue));
    const module = childModule;
    const session = createNativeSourceClassLoadingSession({ resolve: () => module, maxModules: 4 });
    let first: any, firstValue: any;
    for (mode = 0; mode < 4; mode++) {
        const domain = mode === 2 ? root : new ApplicationDomain(root);
        const loaded = await session.load('child', domain);
        const Reader = loaded.getDefinition('child.Reader') as Function, r = Reflect.construct(Reader, []);
        const selected = r.type(), sub = r.childType(), value = r.make(), look = r.lookalike();
        row('identity', [selected === IValue, r.rootType() === IRoot, domain.getDefinition('shared.IValue') === selected, domain.getDefinition('child.IChild') === sub]);
        row('interface-classes', [as3AsClass(selected) !== null, as3AsClass(sub) !== null, as3Is(selected, Function), as3Is(sub, Function), as3TypeOf(selected), as3TypeOf(sub)]);
        row('inherited-interface', [as3Is(value, selected), as3Is(value, sub), as3Is(value, IRoot), r.matches(value), r.rootMatches(value), r.childMatches(value), r.convert(value) === value, r.typed(value) === value]);
        row('parent-match', [r.matches(parent), r.rootMatches(parent), r.childMatches(parent), r.convert(parent) === parent, r.typed(parent) === parent]);
        row('interface-object', [as3Is(sub, IValue), as3Is(sub, IRoot), as3Is(sub, sub), as3Is(selected, sub), r.matches(sub), r.childMatches(sub)]);
        row('lookalike', [as3Is(look, selected), as3Is(look, sub), r.matches(look), r.childMatches(look), r.convert(look)]);
        row('null', [r.typedNull(), r.typed(null), r.matches(null), r.convert(null)]);
        row('dynamic-cast', [as3CallClass(selected, [value]) === value, as3CallClass(sub, [value]) === value, as3CallClass(selected, [null]), as3CallClass(sub, [undefined])]);
        errorRow('typed-error', () => r.typed(look)); errorRow('child-cast-error', () => as3CallClass(sub, [parent])); errorRow('child-construction', () => as3ConstructClass(sub));
        row('enumeration', ['shared::IValue', 'shared::IRoot', 'child::IChild'].map(name => domain.getQualifiedDefinitionNames().includes(name)));
        if (!mode) { first = r; firstValue = value; } else row('cross-domain', [first.type() === selected, first.childType() === sub, first.childMatches(value), r.childMatches(firstValue), r.matches(firstValue)]);
    }
    check('selected parent stays shared across all generated loads', first.type() === IValue);
    session.retire();
    check('child session withdraws its root interfaces', !root.hasDefinition('child.IChild'));
    check('parent survives child session retirement', root.getDefinition('shared.IValue') === IValue);
    check('retained instance keeps interface identity', as3Is(firstValue, IValue));
    parentSession.retire();
    check('parent session withdraws its interface headers', !root.hasDefinition('shared.IValue'));
    return {rows, checks};
}

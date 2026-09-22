import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs} from './native-generated-declarations';
import {NativeGeneratedClassTraits} from './native-generated-traits';
import {NativeGeneratedLexical} from './native-generated-lexical';

export interface NativeGeneratedEmissionOptions {plan: NativeGeneratedDeclarationPlan; module: string;}
export interface NativeClassHelperModules {nativeClass: string; callableClass: string;}
export function generatedModule(value: string): string {
    if (typeof value !== 'string' || !value.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(value))
        throw new Error('AS3_GENERATED_EMISSION_UNSUPPORTED: explicit module binding required');
    return value;
}

/** Compiler-held source and registrar wiring. Does not admit missing lowerings. */
export class NativeGeneratedEmission {
    readonly projection: NativeGeneratedClassTraits;
    readonly lexical: NativeGeneratedLexical;
    readonly sources: {[qname: string]: string} = Object.create(null);
    readonly classes: {[qname: string]: 'lazy' | 'ready'} = Object.create(null);
    constructor(source: string, readonly options: NativeGeneratedEmissionOptions,
        readonly registrar: string, readonly helpers: NativeClassHelperModules,
        readonly lexicalModule: string, readonly propertyModule: string) {
        const fail = (reason: string): never => {throw new Error('AS3_GENERATED_EMISSION_UNSUPPORTED: ' + reason);};
        if (!options || Object.keys(options).some(key => key !== 'plan' && key !== 'module')) fail('exact plan/module configuration required');
        generatedModule(options.module); generatedModule(registrar);
        if (!helpers || Object.keys(helpers).some(key => key !== 'nativeClass' && key !== 'callableClass')) fail('explicit native class helpers required');
        generatedModule(helpers.nativeClass); generatedModule(helpers.callableClass);
        generatedModule(lexicalModule); generatedModule(propertyModule);
        const input = nativeGeneratedDeclarationInputs(options.plan, options.plan && options.plan.scope);
        const owners = Object.keys(input.sources).filter(name => input.sources[name].source === source);
        if (owners.length !== 1) fail('exact current source bytes required');
        this.projection = new NativeGeneratedClassTraits(options.plan,input.scope,owners[0],source);
        if (this.projection.metadata.isDynamic) fail('dynamic source property routing required');
        this.lexical = new NativeGeneratedLexical(options.plan,owners[0],source);
        if (this.lexical.own.some(t => (t.static ? this.projection.staticTraits : this.projection.instanceTraits).some(p => p.name === t.name)))
            fail('public/lexical same-name lookup requires namespace authority');
        if (this.projection.staticTraits.some(trait => trait.kind === 'constant')) fail('source static constant initialization lowering required: ' + owners[0]);
        options.plan.bindings.forEach(binding => {
            this.sources[binding.qname] = input.sources[binding.qname].source;
            this.classes[binding.qname] = 'lazy';
        });
        options.plan.nativeBindings.forEach(binding => this.classes[binding.qname] = 'ready');
        Object.freeze(this.sources); Object.freeze(this.classes); Object.freeze(this);
    }
}

import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs} from './native-generated-declarations';
import {NativeGeneratedClassTraits} from './native-generated-traits';
import {NativeGeneratedLexical} from './native-generated-lexical';
import K from '../syntax/nodeKind';
import Node from '../syntax/node';

// Unary initializers can have a zero-width INIT span in the legacy parser.
// Keep its prefix start, but include the complete operand subtree.
function initializerEnd(node: Node): number {
    return node.children.reduce((end, child) => Math.max(end, initializerEnd(child)), Math.max(node.start, node.end));
}

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
    readonly eventBase: {qname:string; referenceExport:string; eventBaseExport?:string};
    readonly sources: {[qname: string]: string} = Object.create(null);
    readonly classes: {[qname: string]: 'lazy' | 'ready'} = Object.create(null);
    readonly deferredConstants: {[name: string]: string} = Object.create(null);
    constructor(source: string, readonly options: NativeGeneratedEmissionOptions,
        readonly registrar: string, readonly helpers: NativeClassHelperModules,
        readonly lexicalModule: string, readonly propertyModule: string, typedLocals = false) {
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
        let ancestor=this.projection.binding;
        while(ancestor.base) {
            const native=options.plan.nativeBindings.find(binding=>binding.qname===ancestor.base&&!!binding.eventBaseExport);
            if(native){this.eventBase=native;break;}
            ancestor=options.plan.bindings.find(binding=>binding.qname===ancestor.base);
        }
        this.lexical = new NativeGeneratedLexical(options.plan,owners[0],source,typedLocals);
        if(this.projection.binding.scriptGlobalExport) {
            // Publishing a class into a script unit consumes that unit identity.
            // Retry/global identity after a source static initializer fails needs
            // independent evidence; never silently allocate a replacement global.
            const members=this.lexical.ownClass.findChild(K.CONTENT).children;
            if(members.some(member=>[K.VAR_LIST,K.CONST_LIST].indexOf(member.kind)>=0
                &&member.findChild(K.MOD_LIST)&&member.findChild(K.MOD_LIST).children.some(mod=>mod.text==='static')
                &&member.findChildren(K.NAME_TYPE_INIT).some(value=>!!value.findChild(K.INIT))))
                fail('script global with static initializer requires retry identity authority');
        }
        if (this.lexical.own.some(t => (t.static ? this.projection.staticTraits : this.projection.instanceTraits).some(p => p.name === t.name)))
            fail('public/lexical same-name lookup requires namespace authority');
        this.projection.staticTraits.filter(trait => trait.kind === 'constant').forEach(trait => {
            const deferred = ['int','uint','Number','Boolean','String'].indexOf(trait.type as string) < 0;
            const referenceExport=typeof trait.type==='string'?null:trait.type.referenceExport;
            if (deferred && trait.type !== 'Array' && trait.type !== 'Object'
                && (!referenceExport || !options.plan.bindings.some(binding=>binding.tokenExport===referenceExport)))
                fail('static constant type requires initialization authority');
            const members = this.lexical.ownClass.findChild(K.CONTENT).children;
            let literal: string;
            members.filter(member => member.kind === K.CONST_LIST).forEach(member => {
                const mods = member.findChild(K.MOD_LIST);
                if (!mods || !mods.children.some(mod => mod.text === 'static')) return;
                member.findChildren(K.NAME_TYPE_INIT).forEach(field => {
                    if (field.findChild(K.NAME).text !== trait.name) return;
                    const init = field.findChild(K.INIT);
                    if (init) literal = source.slice(init.start,initializerEnd(init)).trim();
                });
            });
            if (deferred) {
                if (!literal) fail('reference static constant requires explicit initializer');
                if (members.some(member=>member.kind===K.CLASS_INITIALIZER))
                    fail('reference constants with class-body statements require interleaving authority');
                let name='__as3_initializeStaticConstant_'+Object.keys(this.deferredConstants).length;
                while(source.indexOf(name)>=0)name+='_';
                this.deferredConstants[trait.name]=name;
                return;
            }
            // Primitive literals are early storage. Computed primitive constants
            // still require their own source initialization authority.
            if (!literal || !/^(?:null|true|false|[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(literal))
                fail('computed static constant initialization requires source authority');
        });
        options.plan.bindings.forEach(binding => {
            this.sources[binding.qname] = input.sources[binding.qname].source;
            this.classes[binding.qname] = 'lazy';
        });
        options.plan.nativeBindings.forEach(binding => this.classes[binding.qname] = 'ready');
        Object.freeze(this.sources); Object.freeze(this.classes); Object.freeze(this.deferredConstants); Object.freeze(this);
    }
}

import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs} from './native-generated-declarations';

/** Build-time emission for complete standalone literal/alias namespace units.
 * The caller validates provider/local module ownership before compiling this body. */
export function emitNativeSourceNamespaceModule(plan: NativeGeneratedDeclarationPlan, provider: string): string {
    const input = nativeGeneratedDeclarationInputs(plan, plan.scope), domain = input.scriptDomainProvider;
    const records = plan.namespaces.map(binding => {
        if (binding.sourceOwner !== binding.qname) throw new Error('AS3_SOURCE_CLASS_MODULE_UNSUPPORTED: mixed namespace source unit');
        const parts = binding.qname.split('.'), name = parts.pop(), uri = parts.join('.');
        return {name:binding.qname, uri:binding.uri, alias:binding.aliasOf || null,
            unit:{sourceId:binding.sourceOwner,sourceSha256:input.sources[binding.sourceOwner].sourceSha256,
                bindings:[{name,uri,kind:'constant',type:'Namespace'}]}};
    });
    return [
        'import {declareAS3SourceNamespace,resolveAS3SourceNamespace,isAS3SourceNamespaceDeclaration,isAS3SourceNamespace,AS3SourceNamespaceDeclaration,AS3SourceNamespaceValue} from '+JSON.stringify(provider)+';',
        'import {selectAS3ScriptDomainDefinition,instantiateAS3ScriptUnit} from '+JSON.stringify(input.scriptGlobalProviderModule)+';',
        'import {'+domain.exportName+' as domain} from '+JSON.stringify(domain.module)+';',
        'type Binding = {name:string;declaration:AS3SourceNamespaceDeclaration;resolve:()=>AS3SourceNamespaceValue};',
        'const records: {name:string;uri:string;alias:string|null;unit:{sourceId:string;sourceSha256:string;bindings:{name:string;uri:string;kind:string;type:string}[]}}[] = '+JSON.stringify(records)+';',
        'const prepared = new Map<string,Binding>();',
        'function prepare(name:string):Binding {',
        '  const existing=prepared.get(name);if(existing)return existing;',
        '  const record=records.find(record=>record.name===name);',
        '  if(!record)throw new Error("Unplanned source namespace: "+name);',
        '  const inherited=selectAS3ScriptDomainDefinition(domain,name);',
        '  let binding:Binding;',
        '  if(inherited) {',
        '    if(!isAS3SourceNamespaceDeclaration(inherited.declaration))throw new TypeError("Inherited namespace is not a namespace declaration: "+name);',
        '    binding={name,declaration:inherited.declaration,resolve:()=>{',
        '      const value=inherited.resolve();if(!isAS3SourceNamespace(value))throw new TypeError("Inherited namespace value required");return value;',
        '    }};',
        '  } else {',
        '    const declaration=declareAS3SourceNamespace(name,record.alias?prepare(record.alias).resolve():record.uri);',
        '    const field=record.unit.bindings[0];',
        '    let value:AS3SourceNamespaceValue;',
        '    binding={name,declaration,resolve:()=>value || (value=instantiateAS3ScriptUnit(domain,',
        '      {sourceId:record.unit.sourceId,sourceSha256:record.unit.sourceSha256,bindings:[{...field,kind:"constant"}]},',
        '      ()=>[{name:field.name,uri:field.uri,value:resolveAS3SourceNamespace(declaration)}]).export(field.name,field.uri) as AS3SourceNamespaceValue)};',
        '  }',
        '  prepared.set(name,binding);return binding;',
        '}',
        'export const namespaceBindings = records.map(record=>prepare(record.name));',
    ].join('\n')+'\n';
}

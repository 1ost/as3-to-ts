// The Loader/Sprite host observer is adapted. All four Shared/Reader/Derived
// subjects are emitted from complete unchanged retained source files.
const root = api.ApplicationDomain.currentDomain;
let parent, headers;
const get = (load, cohort, name) => load('nativeClass').readNativeClass(load(cohort+'_'+name)[name],'value');

const parentBinding = plans.parent[0];
let guards=0;
const check=(condition,label)=>{if(!condition)throw Error(label);guards++;};
const reject=fn=>{let threw=false;try{fn();}catch{threw=true;}check(threw,'Expected declaration rejection');};
const parentModule=api.createNativeSourceClassModule(async()=>domain=>{
    parent=createDomainLoader(domain);headers=parent('parent_declarationDomain');
    return [{name:'shared.Shared',declaration:headers[parentBinding.tokenExport],resolve:()=>get(parent,'parent','Shared')}];
});
let childLoad;
const childModule=api.createNativeSourceClassModule(async()=>domain=>{
    childLoad=createDomainLoader(domain);const bindings=childLoad('child_declarationDomain');
    const ownedLoad=childLoad;
    return plans.child.map(b=>({name:b.qname,declaration:bindings[b.tokenExport],resolve:()=>get(ownedLoad,'child',b.qname.split('.').pop())}));
});
const session=api.createNativeSourceClassLoadingSession({resolve:name=>name==='parent'?parentModule:childModule,maxModules:8});
await session.load('parent',root);
check(instantiations.length===0,'Parent Class initialized during header publication');
const rows=[];
let first,firstValue;
try {
    for(let mode=0;mode<3;mode++) {
        const scope=mode===1?root:new api.ApplicationDomain(root);
        await session.load('child',scope);
        const load=childLoad,bindings=load('child_declarationDomain');
        const sharedBinding=plans.child.find(b=>b.qname==='shared.Shared');
        check(bindings[sharedBinding.tokenExport]===headers[parentBinding.tokenExport],'Child allocated an inherited type token');
        reject(()=>bindings[sharedBinding.publishExport](function Forged(){}));
        const Reader=get(load,'child','Reader'),reader=new Reader();
        if(mode===0)check(!instantiations.includes('shared.Shared'),'Reader typed-null storage initialized Shared');
        const row=(id,value)=>rows.push({id:'mode-'+mode+'-'+id,value});
        row('typed-null',reader.typedNull());const selected=reader.type(),value=reader.make();
        row('class-results',[reader.returnClass(null)===null,reader.returnClass(undefined)===null,reader.returnClass(selected)===selected,reader.returnClass(Object)===Object]);
        try{reader.returnClass({});row('class-wrong','returned');}catch(error){row('class-wrong',[api.as3Is(error,Error),error.errorID]);}
        try{reader.returnClass(function(){});row('class-function','returned');}catch(error){row('class-function',[api.as3Is(error,Error),error.errorID]);}
        row('class-override',reader.overrideClass({})===get(parent,'parent','Shared'));
        try{reader.finallyClass({});row('class-finally','returned');}catch(error){row('class-finally',[api.as3Is(error,Error),error.errorID]);}
        row('parent-identity',selected===get(parent,'parent','Shared'));row('tag',value.tag);
        row('typed',[reader.matches(value),reader.convert(value)===value,reader.typed(value)===value]);
        row('null',[reader.matches(null),reader.convert(null),reader.typed(null)]);
        row('wrong-type',[reader.matches({}),reader.convert({})]);
        try{reader.typed({});row('wrong-entry','returned');}catch(error){row('wrong-entry',[api.as3Is(error,Error),error.errorID]);}
        const Type=reader.derivedType(),derived=reader.makeDerived();
        row('derived',[derived.tag,derived.childTag,api.as3Is(derived,selected),reader.matches(derived),reader.typed(derived)===derived]);
        row('domain-identity',[scope.getDefinition('shared.Shared')===selected,scope.getDefinition('child.Reader')===reader.constructor,scope.getDefinition('child.Derived')===Type]);
        row('enumeration',[scope.getQualifiedDefinitionNames().includes('shared::Shared'),scope.getQualifiedDefinitionNames().includes('child::Reader')]);
        if(mode===0){first=reader;firstValue=value;}else row('cross-cohort',[first.matches(value),reader.matches(firstValue),first.type()===reader.type(),first.derivedType()===Type]);
        check(instantiations.filter(name=>name==='shared.Shared').length===1,'Child ran a second Shared script factory');
    }
    check(api.getDefinitionByName('shared.Shared')===get(parent,'parent','Shared'),'Root registry lost selected identity');
    reject(()=>createDomainLoader({})('child_declarationDomain'));
    reject(()=>createDomainLoader(api.createAS3ScriptDomain())('child_declarationDomain'));
    const closed=api.createAS3ScriptDomain(root);api.unloadAS3ScriptDomain(closed);
    reject(()=>createDomainLoader(closed)('child_declarationDomain'));
    globalThis.result={rows,guards};
} finally {
    session.retire();await session.whenIdle();
}

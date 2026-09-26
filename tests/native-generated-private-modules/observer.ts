import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3DescribeTypeXML,as3DescribeTypeIdentityAttribute} from '@FLASH@/utils/AS3ReflectionQuery';
export async function run(module:NativeSourceClassModule,lifetime:NativeSourceClassModule) {
    const session = createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:4});
    let checks=0;
    const check=(value:boolean)=>{if(!value)throw Error('Private source unit lifecycle check '+checks);checks++;};
    const rejects=(run:()=>unknown)=>{let rejected=false;try{run();}catch{rejected=true;}check(rejected);};
    try {
        const domain = await session.load('probe',new ApplicationDomain(ApplicationDomain.currentDomain));
        const Probe = domain.getDefinition('FileLocalClassesProbe') as any;
        const result = new Probe().snapshot();
        if (!result.ready || result.failure) throw Error('Source snapshot failed');
        const First=domain.getDefinition('localcases.First') as any,a=new First(),x=a.make(1);
        check(as3DescribeTypeIdentityAttribute(x,'name')==='::Helper');
        rejects(()=>as3DescribeTypeXML(x));
        rejects(()=>as3DescribeTypeIdentityAttribute(x,'isFinal' as any));
        rejects(()=>as3DescribeTypeIdentityAttribute({constructor:x.constructor},'name'));
        rejects(()=>as3DescribeTypeIdentityAttribute(Object.create(x),'name'));
        const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
        const Sibling=sibling.getDefinition('localcases.First') as any,b=new Sibling();
        check(Sibling!==First);check(b.type()!==a.type());check(!b.accepts(x));check(b.count()===0);
        const child=await session.load('child',new ApplicationDomain(domain.applicationDomain));
        check(child.getDefinition('localcases.First')===First);
        check(new (child.getDefinition('localcases.First') as any)().type()===a.type());
        session.retire();check(a.read(a.make(9))===9);check(b.read(b.make(7))===7);
        const lifeSession=createNativeSourceClassLoadingSession({resolve:()=>lifetime,maxModules:1});
        let lifetimeRows;
        try {
            const loaded=await lifeSession.load('life',new ApplicationDomain(ApplicationDomain.currentDomain));
            const Life=loaded.getDefinition('FileLocalLifetimeProbe') as any;
            lifetimeRows=new Life().snapshot().observations;
        }finally{lifeSession.retire();}
        return {rows:result.observations,lifetimeRows,checks};
    } finally {session.retire();}
}

import {NativeSourceClassModule,createNativeSourceClassLoadingSession} from '@FLASH@/utils/NativeSourceClassLoadingSession';
import {ApplicationDomain} from '@FLASH@/system/ApplicationDomain';
import {as3Is,as3As,as3CoerceReference} from '@FLASH@/utils/AS3Type';
export async function run(module:NativeSourceClassModule) {
    const session=createNativeSourceClassLoadingSession({resolve:()=>module,maxModules:3});
    let checks=0;
    const check=(value:boolean)=>{if(!value)throw Error('Private interface domain check '+checks);checks++;};
    const rejects=(run:()=>unknown)=>{let rejected=false;try{run();}catch{rejected=true;}check(rejected);};
    try {
        const domain=await session.load('subject',new ApplicationDomain(ApplicationDomain.currentDomain));
        const Probe=domain.getDefinition('FileLocalInterfacesProbe') as any;
        const result=new Probe().snapshot();
        if(!result.ready||result.failure)throw Error('Source snapshot failed');
        const First=domain.getDefinition('localinterfaces.First') as any,a=new First(),x=a.make(6);
        const Value=a.type(),Base=domain.getDefinition('contracts.IBase') as any;
        check(as3Is(x,Value));check(as3Is(x,Base));check(as3As(x,Value)===x);
        const sibling=await session.load('sibling',new ApplicationDomain(ApplicationDomain.currentDomain));
        const Other=sibling.getDefinition('localinterfaces.First') as any,b=new Other(),y=b.make(8);
        const OtherValue=b.type();
        check(Value!==OtherValue);check(a.type()!==b.type());check(!as3Is(x,OtherValue));check(!as3Is(y,Value));
        const SiblingProbe=sibling.getDefinition('FileLocalInterfacesProbe') as any;
        check(new SiblingProbe().snapshot().observations.find((row:any)=>row.id==='cross-is').value.every((value:boolean)=>value===false));
        check(as3As(x,OtherValue)===null);rejects(()=>as3CoerceReference(x,OtherValue));
        const child=await session.load('child',new ApplicationDomain(domain.applicationDomain));
        rejects(()=>child.getDefinition('IValue'));
        check(child.getDefinition('localinterfaces.First')===First);
        check(new (child.getDefinition('localinterfaces.First') as any)().type()===a.type());
        const ChildProbe=child.getDefinition('FileLocalInterfacesProbe') as any;
        check(JSON.stringify(new ChildProbe().snapshot().observations)===JSON.stringify(result.observations));
        for(const owner of [domain,sibling,child])for(const name of ['IValue','::IValue','localinterfaces.IValue'])
            rejects(()=>owner.getDefinition(name));
        session.retire();check(as3Is(x,Value));check(a.read(a.make(10))===10);check(b.read(b.make(12))===12);
        return {rows:result.observations,checks};
    }finally{session.retire();}
}

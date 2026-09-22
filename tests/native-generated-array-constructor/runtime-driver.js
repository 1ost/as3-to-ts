// Host observer; both captured source classes are emitted intact.
const nc=load('nativeClass'),p=load('AS3Property'),errors=load('AS3SourceError');
const Required=nc.readNativeClass(load('Required').Required),Optional=nc.readNativeClass(load('Optional').Optional);
const info=e=>errors.isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];
const failure=fn=>{try{fn();return [];}catch(e){return info(e);}};
const a=[1],rows=[],row=(id,value)=>rows.push({id,value});
row('required-identity',new Required(a).items===a);row('required-null',new Required(null).items===null);row('required-undefined',new Required(undefined).items===null);
row('required-object',failure(()=>new Required({})));row('required-scalar',failure(()=>new Required(7)));row('required-omitted',failure(()=>new Required()));row('required-extra',failure(()=>new Required(a,a)));
row('optional-default',new Optional().items===null);row('optional-identity',new Optional(a).items===a);row('optional-undefined',new Optional(undefined).items===null);row('optional-invalid',failure(()=>new Optional('x')));
globalThis.result=rows;

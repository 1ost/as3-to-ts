const readClass=name=>modules.get('nativeClass').readNativeClass(modules.get(name)[name]);
const Journal=readClass('Journal'),C=readClass('StringPair'),O=readClass('OptionalString'),rows=[];
function rec(id,f){Journal.events=[];try{rows.push({id,value:f(),events:Journal.events.slice()});}catch(e){rows.push({id,error:{name:e.name,errorID:e.errorID},events:Journal.events.slice()});}}
function arg(label,v){Journal.add('arg:'+label);return v;}
function hook(label,kind){return {toString(){Journal.add(label+':toString');if(kind==='throw')throw {name:'Error',errorID:7001};if(kind==='object')return {};if(kind==='null')return null;if(kind==='undefined')return undefined;return label;},valueOf(){Journal.add(label+':valueOf');return kind==='object'?{}:17;}};}
rec('string-required-missing',()=>{new C();return 'body-return';});
rec('string-default',()=>{const x=new C(arg('a','x'));return [x.first,x.second];});
rec('string-null',()=>{const x=new C(arg('a',null),arg('b',null));return [x.first,x.second];});
rec('string-undefined',()=>{const x=new C(arg('a',undefined),arg('b',undefined));return [x.first,x.second];});
rec('string-scalars',()=>{const x=new C(arg('a',123),arg('b',true));return [x.first,x.second];});
rec('string-hooks-order',()=>{const x=new C(arg('a',hook('a','string')),arg('b',hook('b','string')));return [x.first,x.second];});
rec('string-hook-null',()=>{const x=new C(hook('a','null'));return [x.first,x.second];});
rec('string-hook-undefined',()=>{const x=new C(hook('a','undefined'));return [x.first,x.second];});
rec('string-hook-object',()=>{new C(arg('a',hook('a','object')),arg('b',hook('b','string')));return 'body-return';});
rec('string-hook-throw',()=>{new C(arg('a',hook('a','throw')),arg('b',hook('b','string')));return 'body-return';});
rec('string-too-many',()=>{new C(arg('a',hook('a','string')),arg('b',hook('b','string')),arg('extra',3));return 'body-return';});
rec('optional-missing',()=>new O().value);rec('optional-undefined',()=>new O(undefined).value);rec('optional-null',()=>new O(null).value);
globalThis.result=rows;

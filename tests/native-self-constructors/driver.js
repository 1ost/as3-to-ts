const readClass=name=>modules.get('nativeClass').readNativeClass(modules.get(name)[name]);
const P=readClass('PropTween'),rows=[];let events=[];
function rec(id,f){events=[];try{rows.push({id,value:f(),events:events.slice()});}catch(e){rows.push({id,error:{name:e.name,errorID:e.errorID},events:events.slice()});}}
function arg(label,v){events.push('arg:'+label);return v;}
function hook(label,kind){return {toString(){events.push(label+':toString');if(kind==='throw')throw {name:'Error',errorID:7001};return label;},valueOf(){events.push(label+':valueOf');return 17;}};}
const old=new P({},'x',0,1,'x',false);
rec('actual-six',()=>{const x=new P({},'x',1,2,'n',false);return [x.property,x.name,x.priority,x.nextNode===null];});
rec('actual-eight-links',()=>{const x=new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')),false,arg('next',old),arg('priority',3));return [x.property,x.name,x.priority,x.nextNode===old,old.prevNode===x];});
rec('actual-undefined',()=>{const x=new P({},undefined,1,2,undefined,false,undefined);return [x.property,x.name,x.nextNode===null];});
rec('actual-null',()=>{const x=new P({},null,1,2,null,false,null);return [x.property,x.name,x.nextNode===null];});
rec('actual-wrong-self',()=>{new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')),false,arg('next',hook('bad','throw')));return 'body-return';});
rec('actual-self-Class',()=>{new P({},'x',1,2,'n',false,P);return 'body-return';});
rec('actual-too-few',()=>{new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')));return 'body-return';});
rec('actual-too-many',()=>{new P({},arg('property',hook('p','string')),1,2,arg('name',hook('n','string')),false,null,0,arg('extra',9));return 'body-return';});
globalThis.result=rows;
const common=modules.get('AS3MethodBinding'),boundaries=[];
function check(id,ok){if(!ok)throw Error(id);boundaries.push(id);}
function rejects(id,fn,code){let caught=false;try{fn();}catch(e){caught=e.errorID===code;}check(id,caught);}
const valid=new P({},'x',0,1,'x',false),fake=Object.create(P.prototype),tagged={constructor:P};
check('genuine-source-identity',common.as3Is(valid,P));
check('forged-prototype-not-instance',!common.as3Is(fake,P));
check('constructor-tag-not-instance',!common.as3Is(tagged,P));
rejects('forged-self-argument',()=>new P({},'x',0,1,'x',false,fake),1034);
rejects('tagged-self-argument',()=>new P({},'x',0,1,'x',false,tagged),1034);
check('self-field-assignment-rhs',common.as3SetProperty(valid,'nextNode',old)===old);
check('self-field-identity',common.as3GetProperty(valid,'nextNode')===old);
check('undefined-field-rhs',common.as3SetProperty(valid,'nextNode',undefined)===undefined);
check('undefined-field-stored-null',common.as3GetProperty(valid,'nextNode')===null);
rejects('forged-self-field',()=>common.as3SetProperty(valid,'nextNode',fake),1034);
check('failed-field-coercion-keeps-value',common.as3GetProperty(valid,'nextNode')===null);
const constructed=common.as3ConstructValue(P,()=>[{},'x',0,1,'x',false,valid]);
check('common-construction-self-identity',common.as3GetProperty(constructed,'nextNode')===valid&&common.as3Is(constructed,P));
check('private-declaration-name',common.getAS3DeclarationType(P).name==='com.greensock.core::PropTween');
globalThis.boundaries=boundaries;

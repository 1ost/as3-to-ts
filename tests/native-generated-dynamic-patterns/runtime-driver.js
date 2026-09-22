const rows=[],nc=load("nativeClass"),DynamicReplace=nc.readNativeClass(load("DynamicReplace").DynamicReplace),d=new DynamicReplace();
function record(id,fn){try{rows.push({id,value:fn()});}catch(e){
 const info=(api.isAS3SourceError(e)?{name:api.as3GetProperty(e,'name'),errorID:api.as3GetProperty(e,'errorID')}:null);rows.push({id,value:{name:info?.name||e.name,id:info?.errorID||e.errorID||0}});
}}
function callback(fn){api.registerAS3Function(fn,api.getAS3BuiltinScriptGlobal(),3);return fn;}
record('dynamic-basic',()=>[d.replace('a1a','a','g','x'),d.replace('a1a','a','','x')]);
record('dynamic-number',()=>d.replace('a12b12',12,'g','x'));
record('dynamic-null-pattern',()=>d.replace('null/undefined',null,'g','x'));
record('dynamic-undefined-pattern',()=>d.replace('null/undefined',undefined,'g','x'));
record('dynamic-null-flags',()=>d.replace('aaa','a',null,'x'));
record('dynamic-undefined-flags',()=>d.replace('aaa','a',undefined,'x'));
record('dynamic-coercion-order',()=>{const log=[],p={toString(){log.push('pattern');return 'a';}},f={toString(){log.push('flags');return 'g';}},r={toString(){log.push('replacement');return 'x';}};return [d.replace('aa',p,f,r),log];});
record('dynamic-null-receiver-order',()=>{const log=[],p={toString(){log.push('pattern');return 'a';}},f={toString(){log.push('flags');return 'g';}},r={toString(){log.push('replacement');return 'x';}};try{d.replace(null,p,f,r);}catch(e){const info=(api.isAS3SourceError(e)?{name:api.as3GetProperty(e,'name'),errorID:api.as3GetProperty(e,'errorID')}:null);return [info?.name||e.name,info?.errorID||e.errorID||0,log];}return log;});
record('dynamic-empty-subject',()=>[d.replace('',undefined,'g','x'),d.replace('',undefined,'','x')]);
record('dynamic-empty-unicode',()=>[d.replace('\u4e2d\ud83d\ude00A',undefined,'g','x'),d.replace('\u4e2d\ud83d\ude00A',undefined,'','x')]);
record('dynamic-empty-nul',()=>d.replace('A\u0000B',undefined,'g','x'));
record('dynamic-empty-callback',()=>{const log=[],fn=callback(function(m,offset,input){log.push([m,offset,input]);return 'X';});return [d.replace('\u4e2dA',undefined,'g',fn),log];});
record('dynamic-empty-callback-empty',()=>{const log=[],fn=callback(function(m,offset,input){log.push([m,offset,input]);return 'X';});return [d.replace('',undefined,'g',fn),log];});
record('dynamic-empty-callback-first',()=>{const log=[],fn=callback(function(m,offset,input){log.push([m,offset,input]);return 'X';});return [d.replace('AB',undefined,'',fn),log];});
globalThis.result=rows;

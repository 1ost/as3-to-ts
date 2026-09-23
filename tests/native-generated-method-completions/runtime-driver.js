// Separate host observer. Both captured subject classes are emitted in full.
const nc=load('nativeClass'),p=load('AS3Property'),errors=load('AS3SourceError');
const Completions=nc.readNativeClass(load('Completions').Completions),Token=nc.readNativeClass(load('Token').Token);
const s=new Completions(),token=new Token(),rows=[],row=(id,value)=>rows.push({id,value});
row('null-default',[s.nullDefault()===null,s.nullDefault(undefined)===undefined,s.nullDefault(null)===null]);
row('wildcard-identity',s.nullDefault(token)===token);
row('undefined-default',[s.undefinedDefault()===undefined,s.undefinedDefault(null)===null]);
row('false-default',[s.falseDefault(),s.falseDefault(undefined)===undefined,s.falseDefault(null)===null]);
row('number-default',[s.numberDefault(),s.numberDefault(undefined)===undefined,s.numberDefault('x')]);
row('string-default',[s.stringDefault(),s.stringDefault(undefined)===undefined,s.stringDefault(false)]);
row('if-else',[s.choose(17,true),s.choose(17,false)]);
row('switch-returns',[s.switchInteger('first',4.9),s.switchInteger('second',-3.9),s.switchInteger('third',0),s.switchInteger('other',0)]);
row('catch-return-coercion',[s.caught(token)===token,s.caught({})===null,s.caught(undefined)===null]);
let events=[];let value={toString(){events.push('convert');return 'text';}};
let result=s.finalString(value,events);row('return-before-finally',[result,events]);
events=[];value={toString(){events.push('convert');throw 'conversion';}};
let failure=null;try{s.finalString(value,events);}catch(e){failure=e;}
row('conversion-failure-finally',[failure,events]);
row('finally-overrides',[s.overridden(17,23),s.overridden(17,undefined)]);
row('finally-overrides-failure',s.overridden(value,25));
function info(e){return errors.isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}
events=[];failure=null;try{s.caughtFinal({},events);}catch(e){failure=info(e);}row('catch-finally-invalid',[failure,events]);
events=[];row('catch-finally-valid',[s.caughtFinal(token,events)===token,events]);
events=[];failure=null;try{s.thrown(token,events);}catch(e){failure=e;}
row('throw-finally-identity',[failure===token,events]);
events=[];row('outer-catch-conversion',[s.outerCatch({},events)===null,events]);
events=[];failure=null;try{s.nestedFinal({},events);}catch(e){failure=info(e);}row('nested-final-conversion',[failure,events]);
failure=null;try{s.finallyThrow(value,token);}catch(e){failure=e;}row('finally-throw-overrides',failure===token);
const Cancellation=nc.readNativeClass(load('Cancellation').Cancellation),c=new Cancellation();
events=[];value={toString(){events.push('convert');return 'original';}};
result=c.cancelled(value,events);row('caught-throw-cancels-return',[result,events]);
events=[];result=c.caughtInside(value,events);row('inner-catch-retains-return',[result,events]);
events=[];result=c.cancelledAgain(value,17,events);row('nested-finally-replaces-return',[result,events]);
events=[];value={toString(){events.push('convert');throw 'conversion';}};
result=c.loopReturn(value,events);row('loop-catch-conversion',[result,events]);
globalThis.result=rows;

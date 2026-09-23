// Separate observer: the complete AIR subjects are emitted without body edits.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Boundary=klass('DictionaryBoundary'),LogSink=klass('LogSink');
const rows=[],row=(id,value)=>rows.push({id,value});
const get=(object,key)=>api.as3GetProperty(object,key);
const error=e=>api.as3IsSourceErrorInstance(e)?[get(e,'name'),get(e,'errorID')]:[e.name,e.errorID];
const typeError=e=>api.as3IsSourceErrorInstance(e)&&api.sourceErrorParent(e)===api.getAS3SourceErrorPrototype('TypeError');
const isDictionary=v=>api.as3Is(v,api.Dictionary);
const good=new api.Dictionary(),weak=new api.Dictionary(true);
const info=(v,input)=>[v===input,v===good,v===null,v===undefined,v==null?'':api.getQualifiedClassName(v)];
let subject=new Boundary();
row('default',[subject.queue===null,subject.raw===undefined,subject.entries,isDictionary(subject.dic),subject.dic===subject.dic]);
for(const [label,input] of [['dictionary',good],['weak',weak],['null',null],['undefined',undefined],['array',[]],['object',{}],['number',7]]){
 for(const method of ['read','exchange','assign','local']){
  subject=new Boundary();subject.queue=good;subject.raw=input;
  const call=get(subject,method);let result;
  try{const output=api.as3CallValue(call,()=>method==='read'?[]:[input]);result={ok:true,value:info(output,input)};}
  catch(e){result={ok:false,error:error(e)[0],errorID:error(e)[1],sourceError:api.as3IsSourceErrorInstance(e),typeError:typeError(e)};}
  row(method+'-'+label,[result,subject.entries,subject.queue===good,subject.queue===null]);
 }
 subject=new Boundary();const prior=subject.dic;let result;
 try{subject.dic=input;result={ok:true};}
 catch(e){result={ok:false,error:error(e)[0],errorID:error(e)[1],typeError:typeError(e)};}
 const after=subject.dic;
 row('setter-'+label,[result,subject.entries,after===prior,after===input,isDictionary(after),after===subject.dic]);
}
subject=new Boundary();subject.queue=good;
row('catch-invalid',[subject.catchAssignment({}),subject.queue===good]);
row('catch-undefined',[subject.catchAssignment(undefined),subject.queue===null]);
const fn=get(subject,'exchange');
for(const [id,args] of [['missing-argument',[]],['extra-argument',[good,good]]]){
 try{api.as3CallValue(fn,()=>args);row(id,'accepted');}catch(e){row(id,[...error(e),subject.entries]);}
}
const objectKey=api.as3CreateDynamicObject(),objectValue=api.as3CreateDynamicObject();
row('getter-key-empty',[subject.readThroughGetter(objectKey)===undefined,subject.hasThroughGetter(objectKey)]);
row('getter-key-write',[subject.writeThroughGetter(objectKey,objectValue)===objectValue,subject.readThroughGetter(objectKey)===objectValue,subject.hasThroughGetter(objectKey),subject.readThroughGetter(api.as3CreateDynamicObject())===undefined]);
row('getter-key-delete',[subject.removeThroughGetter(objectKey),subject.hasThroughGetter(objectKey),subject.readThroughGetter(objectKey)===undefined,subject.removeThroughGetter(objectKey)]);
subject.writeThroughGetter(7,'seven');
row('getter-key-number',[subject.readThroughGetter('7'),subject.hasThroughGetter('7'),subject.removeThroughGetter('7'),subject.readThroughGetter(7)===undefined]);
subject.writeThroughGetter('toString',objectValue);
row('getter-key-collision',[subject.readThroughGetter('toString')===objectValue,subject.removeThroughGetter('toString'),api.as3Is(subject.readThroughGetter('toString'),Function)]);
row('separate-dictionaries',[new Boundary().dic!==subject.dic]);
const ELogger=klass('ELogger'),direct=new ELogger(),logger=ELogger.inst;
row('logger-singleton',[logger===ELogger.inst,direct!==logger,direct.dic!==logger.dic,logger.logout===logger.record,logger.logMaxLine]);
try{new ELogger();row('logger-duplicate','accepted');}
catch(e){row('logger-duplicate',[get(e,'name'),get(e,'message'),logger===ELogger.inst]);}
row('logger-empty',logger.getLog());
logger.addLog('one');logger.addLogFrame('frame');logger.addLogError('error');
row('logger-categories',[logger.getLog(),logger.getLog(ELogger.FRAME),logger.getLog(ELogger.ERROR),logger.getLog(ELogger.ALL)]);
logger.logMaxLine=2;
logger.addLog('two');logger.addLog('three');logger.addLog('four');logger.addLog('five');
row('logger-limits',[get(logger.dic,ELogger.NORMAL).length,logger.getLog(),get(logger.dic,ELogger.ALL).length,logger.getLog(ELogger.ALL)]);
row('logger-range',[logger.getLog(ELogger.NORMAL,1,1),logger.getLog(ELogger.NORMAL,9,9),logger.getLog(ELogger.NORMAL,-1,-1)]);
logger.deleteRecord(ELogger.NORMAL);
row('logger-delete',[logger.getLog(),logger.getLog(ELogger.ALL)]);
const sink=new LogSink();logger.logout=sink.record;
logger.addLog('callback',ELogger.ERROR);logger.addLog('all-only',ELogger.ALL);
row('logger-callback',sink.calls.slice());
logger.logout=null;logger.addLog('ignored');
row('logger-null-callback',[sink.calls.length,logger.getLog()]);
logger.logout=logger.record;logger.dic=weak;
row('logger-dictionary-replacement',[logger.dic===weak,logger.getLog()]);
logger.addLog('weak-log');
row('logger-replaced-record',[get(weak,ELogger.NORMAL)[0],get(weak,ELogger.ALL)[0]]);
try{logger.dic={};row('logger-invalid-dictionary','accepted');}
catch(e){row('logger-invalid-dictionary',[...error(e),logger.dic===weak]);}
logger.dic=null;const recovered=logger.dic;
row('logger-null-dictionary',[isDictionary(recovered),recovered!==weak,recovered===logger.dic,logger.getLog()]);
logger.dic=undefined;
row('logger-undefined-dictionary',[isDictionary(logger.dic),logger.dic!==recovered,logger.dic===logger.dic]);
// Independent AIR run: fresh declaration domain, same complete ELogger source.
const printLoad=createDomainLoader(),PrintLogger=nc.readNativeClass(printLoad('ELogger').ELogger),printer=PrintLogger.inst;
let traceOutput='';const traceLease=api.installNativeTraceHost({write(text){traceOutput+=text;}});
try{
 printer.printToScreen=true;printer.addLog('printed');
 row('trace-enabled',[printer.getLog(),printer.getLog(PrintLogger.ALL)]);
 printer.addLog('category-only',PrintLogger.FRAME);
 row('trace-category',[printer.getLog(PrintLogger.FRAME),printer.getLog(PrintLogger.ALL)]);
 printer.printToScreen=false;printer.addLog('silent',PrintLogger.ALL);
 row('trace-disabled',printer.getLog(PrintLogger.ALL));
 printer.printToScreen=true;printer.addLog(null,PrintLogger.ALL);
 row('trace-null-message',printer.getLog(PrintLogger.ALL));
}finally{traceLease.dispose();}
row('trace-output',traceOutput);
globalThis.result=rows;

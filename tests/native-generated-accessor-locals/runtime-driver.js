const p=load('AS3Property'),inv=load('AS3Invocation'),nc=load('nativeClass');
const get=name=>nc.readNativeClass(load(name)[name],'value');
const AccessorLocals=get('AccessorLocals'),Cell=get('Cell'),Token=get('Token');
const subject=new AccessorLocals(),cell=new Cell(),token=new Token(),sentinel={},rows=[];let events=[];
const register=fn=>inv.registerAS3Function(fn,load('AS3ScriptGlobal').getAS3BuiltinScriptGlobal(),fn.length);
function encode(v){if(v===undefined)return 'undefined';if(v!==v)return 'NaN';if(v===0&&1/v<0)return '-0';if(v===cell)return 'cell';if(v===token)return 'token';if(v===sentinel)return 'sentinel';if(v!==null&&v===subject.input&&(typeof v==='object'||typeof v==='function'))return 'input';return Array.isArray(v)?v.map(encode):v;}
function failure(e){return e===sentinel?['sentinel']:load('AS3SourceError').isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}
function capture(id,key,value,write=false){subject.input=value;subject.observed=null;events=[];let result=null,error=[];try{result=write?(subject[key]=value):subject[key];}catch(e){error=failure(e);}rows.push({id,value:[encode(result),encode(subject.observed),error,events.slice(),result===value]});}
   capture("defaults","defaults",null);subject.link=cell;
   capture("getter-wrap","value",4294967297);capture("getter-undefined","value",undefined);
   capture("setter-number","value",7,true);capture("setter-undefined","value",undefined,true);
   capture("unsigned-negative","unsigned",-1.9);capture("unsigned-undefined","unsigned",undefined);
   capture("numeric-negative","numeric",-1.9,true);capture("numeric-undefined","numeric",undefined,true);
   var number={valueOf:register(function(){events.push("number");return 4294967297;})};
   var text={toString:register(function(){events.push("string");return "converted";})};
   var badNumber={valueOf:register(function(){events.push("number-throw");throw sentinel;})};
   var badText={toString:register(function(){events.push("string-throw");throw sentinel;})};
   capture("getter-hook","value",number);capture("numeric-hook","numeric",number,true);
   capture("numeric-throw","numeric",badNumber,true);capture("setter-hook","value",text,true);capture("setter-throw","value",badText,true);
   capture("reference-get","reference",cell);capture("reference-get-undefined","reference",undefined);capture("reference-get-bad","reference",token);
   capture("reference-set","reference",cell,true);capture("reference-set-undefined","reference",undefined,true);capture("reference-set-bad","reference",token,true);
   capture("contract-get","contract",token);capture("contract-get-undefined","contract",undefined);capture("contract-get-bad","contract",cell);
   capture("contract-set","contract",token,true);capture("contract-set-undefined","contract",undefined,true);capture("contract-set-bad","contract",cell,true);
   subject.link=null;capture("length-empty","length",null);subject.link=cell;capture("length-one","length",null);
   cell.next=new Cell();cell.next.next=new Cell();capture("length-three","length",null);
   subject.early=true;capture("hoisted-early","hoisted",null);subject.early=false;capture("hoisted-late","hoisted",null);
   capture("raw-assignment","assignment",4294967297);capture("raw-hook","assignment",number);
   capture("text-hook","text",text);capture("text-throw","text",badText);
   rows.push({id:"static-defaults",value:encode(AccessorLocals.staticDefaults)});

globalThis.result=rows;

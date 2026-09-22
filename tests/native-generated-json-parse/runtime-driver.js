// Separate host observer; the complete captured Parser class is emitted unchanged.
const nc=load('nativeClass'),e=load('AS3SourceError'),p=load('AS3Property'),Parser=nc.readNativeClass(load('Parser').Parser),parser=new Parser();
const rows=[],row=(id,value)=>rows.push({id,value});
const failure=fn=>{try{fn();return [];}catch(x){return [x.name,x.errorID,e.as3IsSourceErrorInstance(x),e.as3IsSourceSyntaxErrorInstance(x)];}};
const inputs=['{','',' ','[1,]','{"a":01}','NaN','Infinity','[true false]','"\\x41"','"unterminated','-','1e','1 2','{1:2}',null,undefined];
inputs.forEach((text,i)=>row('invalid-'+i,failure(()=>parser.parse(text))));
row('source-catch',[parser.caught('{'),parser.caught('null')]);
const events=[],err=failure(()=>parser.parse('{',(k,v)=>{events.push(k);return v;}));row('invalid-skips-reviver',[err,events]);
const token={};let same=false;try{parser.parse('1',()=>{throw token;});}catch(x){same=x===token;}row('reviver-object-identity',same);
const syntax=Object.assign(new SyntaxError('user'),{errorID:777});same=false;try{parser.parse('1',()=>{throw syntax;});}catch(x){same=x===syntax;}row('reviver-syntax-identity',[same,syntax.errorID]);
row('valid-primitives',[parser.parse('null')===null,parser.parse('true'),parser.parse('3'),parser.parse('"text"')]);
row('valid-number-rounding',[parser.parse('1.9999999999999998'),parser.parse('11.200000000000001')]);
const numbers=['01','-01','00.5','012e2','00','0001','-00','0x10','+1','.5','1.','1.e2','[01,002]'];
numbers.forEach((text,i)=>{let value;try{const v=parser.parse(text);value=['ok',v,typeof v==='number'&&v===0&&1/v===-Infinity];}catch(x){value=['error',x.name,x.errorID];}row('number-grammar-'+i,value);});
globalThis.result=rows;

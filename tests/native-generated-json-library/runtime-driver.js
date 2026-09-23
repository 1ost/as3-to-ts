// Observer only; all seven maintained subjects and authored Reader are emitted in full.
const klass=name=>load('nativeClass').readNativeClass(load(name)[name]);
const JSONA=klass('JSONA'),Token=klass('JSONToken'),Reader=klass('Reader'),Tokenizer=klass('JSONTokenizer'),ParseError=klass('JSONParseError');
const rows=[],row=(id,value)=>rows.push({id,value}),get=(o,k)=>api.as3GetProperty(o,k);
const reader=new Reader(new Token(7,'public'));
row('receiver-read',reader.read());row('receiver-write',reader.write('changed'));row('receiver-parameter',reader.parameter(new Token(8,'argument')));row('receiver-null-value',reader.write(null));reader.replace(null);
try{reader.read();row('receiver-null','accepted');}catch(error){if(!api.as3IsSourceErrorInstance(error))throw error;row('receiver-null',[get(error,'name'),get(error,'errorID')]);}
const samples=['null','true','false','17','-12.5e2','"text"','[]','{}','[1,true,null,"x"]','{"a":[1,2],"b":false}',' /* comment */ [3] ','"a\\n\\u0041"','01','true trailing'];
const invalid=['','[','{"a" 1}','[1 2]','"unterminated','truX','1e','/*'];
for(const [prefix,inputs] of [['decode-',samples],['invalid-',invalid]])inputs.forEach((input,index)=>{
 try {row(prefix+index,JSONA.decode(input));}
 catch(error) {
  if(api.as3Is(error,ParseError))row(prefix+index,['name','message','location','text'].map(k=>get(error,k)));
  else if(api.as3IsSourceErrorInstance(error))row(prefix+index,[get(error,'name'),get(error,'errorID')]);
  else throw error;
 }
});
const object=api.as3CreateDynamicObject();api.as3SetProperty(object,'a',1);
const values=[null,true,false,17,-12.5,'a\n"\\',[],[1,true,null,'x'],object,NaN,Infinity];
values.forEach((value,index)=>row('encode-'+index,JSONA.encode(value)));
const tokenizer=new Tokenizer('[1,"a",false]'),tokens=[];
let token;while((token=tokenizer.getNextToken())!==null)tokens.push([get(token,'type'),get(token,'value')]);
row('tokens',tokens);globalThis.result=rows;

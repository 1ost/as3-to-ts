// Observer only; all five maintained subjects are emitted in full.
const klass=name=>load('nativeClass').readNativeClass(load(name)[name]);
const Decoder=klass('JSONDecoder'),Tokenizer=klass('JSONTokenizer'),ParseError=klass('JSONParseError');
const rows=[],row=(id,value)=>rows.push({id,value}),get=(o,k)=>api.as3GetProperty(o,k);
const samples=['null','true','false','17','-12.5e2','"text"','[]','{}','[1,true,null,"x"]','{"a":[1,2],"b":false}',' /* comment */ [3] ','"a\\n\\u0041"','01','true trailing'];
const invalid=['','[','{"a" 1}','[1 2]','"unterminated','truX','1e','/*'];
for(const [prefix,inputs] of [['decode-',samples],['invalid-',invalid]])inputs.forEach((input,index)=>{
 try {row(prefix+index,new Decoder(input).getValue());}
 catch(error) {
  if(api.as3Is(error,ParseError))row(prefix+index,['name','message','location','text'].map(k=>get(error,k)));
  else if(api.as3IsSourceErrorInstance(error))row(prefix+index,[get(error,'name'),get(error,'errorID')]);
  else throw error;
 }
});
const tokenizer=new Tokenizer('[1,"a",false]'),tokens=[];
let token;while((token=tokenizer.getNextToken())!==null)tokens.push([get(token,'type'),get(token,'value')]);
row('tokens',tokens);globalThis.result=rows;

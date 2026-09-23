// Observe the complete emitted source; no local Boolean conversion substitute.
const Convert=load('nativeClass').readNativeClass(load('Convert').Convert),Shadow=load('nativeClass').readNativeClass(load('Shadow').Shadow);
let subject=new Convert();const rows=[],row=(id,value)=>rows.push({id,value});
const cases=[['undefined',undefined],['null',null],['false',false],['true',true],['zero',0],['negative-zero',-0],['nan',NaN],['infinity',Infinity],['negative',-3],['fraction',0.5],['empty-string',''],['zero-string','0'],['false-string','false'],['space',' '],['object',{}],['array',[]],['function',function(){}],['class',Convert]];
for(const [id,value] of cases){const result=subject.cast(value);row(id,[typeof result,result]);}
let result=subject.numeric(2);row('numeric',[typeof result,result]);
result=subject.side(0);row('side-false',[typeof result,result,subject.calls]);
result=subject.side('0');row('side-true',[typeof result,result,subject.calls]);
let hooks=0;const object={valueOf(){hooks++;return 0;},toString(){hooks++;return '';}};
result=subject.cast(object);row('no-hooks',[typeof result,result,hooks]);
subject=new Convert();row('loop-zero',subject.loop(0));subject=new Convert();row('loop-four',subject.loop(4));row('shadow',new Shadow().read());
globalThis.result=rows;

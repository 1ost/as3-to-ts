// Observer only; StringStore is emitted from the complete AIR source.
const StringStore=load('nativeClass').readNativeClass(load('StringStore').StringStore);
const rows=[],row=(id,value)=>rows.push({id,value});
const seeds=[null,"","a"],values=[null,undefined,1,true,"/"];
seeds.forEach((seed,i)=>values.forEach((value,j)=>{StringStore.reset(seed);row('scalar-'+i+'-'+j,StringStore.append(value));}));
StringStore.reset('start');row('rhs-write',StringStore.replaceDuringAppend('/'));
const calls=[];
const ordinary={toString(){calls.push('string');return 'S';},valueOf(){calls.push('number');return 7;}};
StringStore.reset('a');row('string-hint',[StringStore.append(ordinary),calls.slice()]);calls.length=0;
StringStore.reset(null);row('null-hint',[StringStore.append(ordinary),calls.slice()]);
const failure={},throwing={toString(){throw failure;}};
StringStore.reset('kept');try{StringStore.append(throwing);row('conversion-throw','accepted');}
catch(error){row('conversion-throw',[error===failure,StringStore.read()]);}
row('instance',new StringStore('local').appendLocal('/'));
globalThis.result=rows;

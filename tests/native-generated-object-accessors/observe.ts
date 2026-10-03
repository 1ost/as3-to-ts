import {as3GetProperty as get,as3SetProperty as set} from '@FLASH@/utils/AS3Property';
import {describeRegisteredFlashType} from '@FLASH@/utils/FlashTypeMetadata';
import {QName} from '@FLASH@/utils/QName';
const error=(fn:()=>unknown)=>{try{fn();return 'none';}catch(e){return e.name+':'+e.errorID;}};
export function observe({Base,Child,Grand,WriteBase,Writer,PairBase,PairChild}:any){
 const base=new Base(),child=new Child(),grand=new Grand(),writer=new Writer(),pair=new PairChild(),rows:any[]=[];
 const row=(id:string,value:unknown)=>rows.push({id,value});
 row('initial',[base.value===null,child.value===null,grand.value===null,writer.value===null,pair.value===null]);
 const token={label:'first'};child.value=token;row('new-setter',[child.value===token,child.throughBase()===token,child.stored===token,child.writes]);
 grand.value=token;row('inherited-new-setter',[grand.value===token,grand.throughBase()===token,grand.writes]);
 writer.value=token;row('new-getter',[writer.value===token,writer.stored===token,writer.writes]);
 writer.throughBase(null);row('virtual-setter',[writer.value===null,writer.writes]);
 pair.value=token;row('pair-override',[pair.value===token,pair.writes]);
 row('pair-base-virtual',[pair.throughBase(token)===token,pair.writes]);
 const inputs:any[]=[null,undefined,7,true,NaN,{},[],['a','b'],'text',function(){}];
 for(let i=0;i<inputs.length;i++){const item=inputs[i],result=set(child,'value',item),stored=child.value;row('dynamic-'+i,[stored===null,stored===item,typeof stored,child.writes,result===item,result!==result]);}
 let calls=0;const item={toString(){calls++;throw new Error('must not convert');},valueOf():any{calls++;return null;}},result=set(child,'value',item);
 row('no-conversion',[child.value===item,child.writes,calls,result===item]);
 set(child,new QName('','value'),token);row('qname',[child.value===token,child.writes]);
 row('base-remains-readonly',[error(()=>set(base,'value',token)),base.value===null]);
 row('base-remains-writeonly',[error(()=>get(new WriteBase(),'value'))]);
 for(const subject of [base,child,grand,new WriteBase(),writer,new PairBase(),pair]){const desc=describeRegisteredFlashType(subject)!;const member=desc.accessors.find(a=>a.name==='value')!;row('reflection-'+desc.name,[member.type,member.access,member.declaredBy]);}
 return rows;
}

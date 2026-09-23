const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Reader=klass('Reader'),Mediator=klass('Mediator');
const rows=[],r=new Reader(),shape=new api.Shape(),sprite=new api.Sprite();
const values=[shape,sprite,new api.EventDispatcher(),null,undefined,{},[],7,api.DisplayObject.prototype];
for(let i=0;i<values.length;i++){
 const value=values[i],before=r.calls,matches=r.test(value),cast=r.cast(value);
 rows.push({id:'identity-'+i,value:[matches,cast===value,cast===null,r.calls-before]});
 try{const slot=r.coerce(value);rows.push({id:'coerce-'+i,value:[slot===value,slot===null]});}
 catch(error){rows.push({id:'coerce-'+i,value:[error.name,error.errorID]});}
}
const m=new Mediator('probe',shape);
rows.push({id:'mediator-identity',value:[m.getMediatorName(),m.getViewComponent()===shape]});
m.x=12;m.y=24;rows.push({id:'mediator-position',value:[shape.x,shape.y]});
m.relocate(new api.Rectangle(0,0,100,100),new api.Rectangle(0,0,200,200));
rows.push({id:'mediator-relocate',value:[shape.x,shape.y]});
rows.push({id:'mediator-formula',value:[m.getLeftPosition(0,10,20,0,100),m.getLeftPosition(0,10,20,30,100)]});
const other=Object.assign(api.as3CreateDynamicObject(),{x:1,y:2});
m.setViewComponent(other);m.x=9;m.y=8;m.relocate(new api.Rectangle(),new api.Rectangle());
rows.push({id:'mediator-nondisplay',value:[other.x,other.y,m.getViewComponent()===other]});
m.setViewComponent(null);m.x=9;m.y=8;m.relocate(new api.Rectangle(),new api.Rectangle());
rows.push({id:'mediator-null',value:m.getViewComponent()===null});
// These are provider rejection controls, separate from the AIR observations.
let traps=0;
const forged=[Object.create(api.DisplayObject.prototype),Object.create(api.Shape.prototype),
 {constructor:api.DisplayObject},new Proxy({}, {get(){traps++;throw Error('observed host getter');},getPrototypeOf(){traps++;throw Error('observed host prototype');}})];
for(const value of forged){
 if(r.test(value)!==false||r.cast(value)!==null)throw Error('forged display identity accepted');
 let caught;try{r.coerce(value);}catch(error){caught=error;}
 if(!caught||caught.errorID!==1034)throw Error('forged display coercion accepted');
}
if(traps!==0)throw Error('display reference inspected untrusted host value');
globalThis.result=rows;

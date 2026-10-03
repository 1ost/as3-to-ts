package {
 import com.greensock.TweenMax;
 import com.greensock.core.SimpleTimeline;
 public class DelayedParamsOracle {
  public function snapshot():Object {
   var rows:Array=[], a:DelayedParamsSubject=new DelayedParamsSubject(), b:DelayedParamsSubject=new DelayedParamsSubject();
   var timeline:SimpleTimeline=new SimpleTimeline({paused:true}); timeline.autoRemoveChildren=true;
   var args:Array=["old",1];
   timeline.insert(TweenMax(a.start(.25,args)),timeline.cachedTime);
   timeline.insert(TweenMax(b.start(.5,["other",2])),timeline.cachedTime);
   rows.push({id:"deferred",value:[a.calls,b.calls]});
   rows.push({id:"argument-order",value:a.evaluations.concat()});
   args[0]="changed";args[1]=7;args=["replacement",99];
   timeline.renderTime(.249,false,false);rows.push({id:"before-first",value:[a.calls,b.calls]});
   timeline.renderTime(.25,false,false);rows.push({id:"retained-array-and-receiver",value:[a.calls,b.calls,a.received.concat()]});
   timeline.renderTime(.5,false,false);rows.push({id:"second-receiver",value:b.received.concat()});
   timeline.insert(TweenMax(a.start(0,["zero",3])),timeline.cachedTime);rows.push({id:"zero-deferred",value:a.calls});
   timeline.renderTime(.501,false,false);rows.push({id:"zero-delivered",value:a.received.concat()});
   timeline.insert(TweenMax(a.start(.25,["cancel",4])),timeline.cachedTime);a.cancel();
   timeline.renderTime(1,false,false);rows.push({id:"cancelled-method-closure",value:a.calls});
   timeline.insert(TweenMax(a.start(.1,null)),timeline.cachedTime);
   timeline.renderTime(1.101,false,false);rows.push({id:"null-params",value:a.received.concat()});
   timeline.insert(TweenMax(a.start(.1,[])),timeline.cachedTime);
   timeline.renderTime(1.202,false,false);rows.push({id:"empty-params",value:a.received.concat()});
   timeline.insert(TweenMax(a.omitted(.1)),timeline.cachedTime);
   timeline.renderTime(1.303,false,false);rows.push({id:"omitted-params",value:a.received.concat()});
   rows.push({id:"single-evaluation",value:[a.evaluations.concat(),b.evaluations.concat()]});
   var item:Object={label:"before"}, source:Array=[item];
   DelayedParamsSubject.items=[];
   timeline.insert(TweenMax(DelayedParamsSubject.startItem(.1,source,0)),timeline.cachedTime);
   source[0]={label:"replaced"};item.label="after";
   rows.push({id:"static-deferred",value:DelayedParamsSubject.items.length});
   timeline.renderTime(1.404,false,false);
   rows.push({id:"literal-element-capture",value:[DelayedParamsSubject.items.length,DelayedParamsSubject.items[0]===item,DelayedParamsSubject.items[0].label]});
   timeline.kill();return {ready:true,failure:"",observations:rows};
  }
 }
}

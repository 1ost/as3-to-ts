package {import com.greensock.TweenMax;import com.greensock.core.SimpleTimeline;
 public class DelayedOracle {
  public function snapshot():Object {
   var rows:Array=[],a:DelayedSubject=new DelayedSubject(),b:DelayedSubject=new DelayedSubject(),timeline:SimpleTimeline=new SimpleTimeline({paused:true});timeline.autoRemoveChildren=true;
   var handle:TweenMax=TweenMax(a.start(.25));timeline.insert(handle,timeline.cachedTime);
   timeline.insert(TweenMax(b.start(.5)),timeline.cachedTime);
   rows.push({id:"deferred",value:[a.calls,b.calls]});
   rows.push({id:"argument-order",value:a.evaluations.concat()});
   timeline.renderTime(.249,false,false);rows.push({id:"before-first",value:[a.calls,b.calls]});
   timeline.renderTime(.25,false,false);rows.push({id:"first-bound-receiver",value:[a.calls,b.calls]});
   timeline.renderTime(.5,false,false);rows.push({id:"second-bound-receiver",value:[a.calls,b.calls]});
   timeline.insert(TweenMax(a.start(0)),timeline.cachedTime);rows.push({id:"zero-deferred",value:a.calls});
   timeline.renderTime(.501,false,false);rows.push({id:"zero-delivered",value:a.calls});
   timeline.insert(TweenMax(a.start(.25)),timeline.cachedTime);a.cancel();
   timeline.renderTime(1,false,false);rows.push({id:"cancelled-method-closure",value:a.calls});
   rows.push({id:"single-argument-evaluation",value:[a.evaluations.concat(),b.evaluations.concat()]});
   timeline.kill();return {ready:true,failure:"",observations:rows};
  }
 }
}
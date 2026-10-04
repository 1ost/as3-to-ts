package cases {
 import flash.display.MovieClip;
 public class Probe {
  public function snapshot():Object {
   var rows:Array=[];
   var clip:MovieClip=new MovieClip();
   var child:Object={label:"child"};clip["downArrow"]=child;
   var reader:Reader=new Reader(clip);
   rows.push({id:"implicit",value:[reader.read()===child,reader.readCount,reader.own().label]});
   rows.push({id:"explicit",value:[reader.explicitRead()===child,reader.readCount]});
   rows.push({id:"local",value:[reader.localRead(clip)===child,reader.readCount]});
   clip["downArrow"]={label:"changed"};
   rows.push({id:"changed",value:[reader.read().label,reader.readCount,reader.own().label]});
   reader.replace(new MovieClip());
   rows.push({id:"missing",value:[reader.read()===undefined,reader.readCount]});
   reader.replace(null);
   try {reader.read();rows.push({id:"null",value:"accepted"});}
   catch(e:Error){rows.push({id:"null",value:[e.name,e.errorID,reader.readCount]});}
   try {reader.explicitRead();rows.push({id:"null-explicit",value:"accepted"});}
   catch(e:Error){rows.push({id:"null-explicit",value:[e.name,e.errorID,reader.readCount]});}
   reader.replace(clip);
   rows.push({id:"restored",value:[reader.read().label,reader.readCount,reader.own().label]});
   return {ready:true,failure:"",observations:rows};
  }
 }
}

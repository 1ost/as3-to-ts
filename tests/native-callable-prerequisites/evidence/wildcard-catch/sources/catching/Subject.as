package catching {
 public class Subject {
  public var survived:Boolean=false;
  public function Subject(value:*,mode:int) {
   try {
    try { throw value; }
    catch (caught : /* wildcard */ *) {
     Journal.rows.push("caught:"+(caught===Journal.expected));
     Journal.rows.push("kind:"+typeof caught);
     if(mode===1)throw caught;
     try {throw caught;} catch(inner:*) {Journal.rows.push("nested:"+(inner===caught));inner="replacement";}
     Journal.rows.push("unchanged:"+(caught===Journal.expected));
    } finally {Journal.rows.push("inner-finally");}
   } catch(outer:*) {Journal.rows.push("outer:"+(outer===Journal.expected));throw outer;}
   finally {Journal.rows.push("outer-finally");}
   survived=true;
  }
 }
}
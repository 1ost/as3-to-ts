package replay {
 public class Subject extends Base {
  public var stage:int=Journal.mark("derived-field");
  public function Subject(){
   Journal.attempt("active",this,Subject);
   super(Journal.argument(this));Journal.rows.push("derived-body:"+stage);
  }
 }
}

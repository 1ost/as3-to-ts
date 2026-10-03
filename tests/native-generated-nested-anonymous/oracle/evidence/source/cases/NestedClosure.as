package cases {
 public class NestedClosure {
  private var _calls:int;
  public function prepare(value:*):Function {
   var outer:uint=value;
   return function(step:*):* {
    var middle:uint=step;
    return function(extra:*):* {
     middle+=extra;
     outer+=middle;
     _calls++;
     return [outer,middle,_calls];
    };
   };
  }
  public function chain(value:int):Function {
   var leaf:int=value;
   return function():* {
    return function():* {
     return function():* {
      return function():* {
       return function():* {
        leaf++;
        _calls++;
        return [leaf,_calls];
       };
      };
     };
    };
   };
  }
  public function calls():int {return _calls;}
 }
}

package {public class UnarySubject {
 private var count:int=0;
 private function next():Number {this.count++;return this.count;}
 public function values():Array {
  var object:Object={negative:-10,positive:+"12",zero:-0,parenthesized:-(2+3),nested:- -3,math:-5+2,commented:- /* keep prefix */ 7,first:-this.next(),second:+this.next(),child:{negative:-4},unchanged:~1};
  return [object.negative,object.positive,typeof object.positive,String(1/object.zero),object.parenthesized,object.nested,object.math,object.commented,object.first,object.second,object.child.negative,object.unchanged,this.count];
 }
}}

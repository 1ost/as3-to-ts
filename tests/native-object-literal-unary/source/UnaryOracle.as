package {public class UnaryOracle {
 public function snapshot():Object {var subject:UnarySubject=new UnarySubject();return {ready:true,failure:"",observations:[{id:"first",value:subject.values()},{id:"second",value:subject.values()}]};}
}}

package cases {public class NumericClosure {
 public function make(seed:*):Function {var outer:int;return function():Object {
 var local:uint;var before:*=local;var raw:*=(local=seed);var outerRaw:*=(outer=seed);
 return [before,raw,local,outerRaw,outer];
 };}
}}

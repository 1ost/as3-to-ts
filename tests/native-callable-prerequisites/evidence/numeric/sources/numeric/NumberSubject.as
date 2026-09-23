package numeric { public class NumberSubject {
 public function NumberSubject(a:Number=7.5,b:Number=-0) {
  Recorder.record("entry", a, b, arguments);
  a = 41; Recorder.record("parameter-write", a, b, arguments);
  arguments[1] = 43; Recorder.record("arguments-write", a, b, arguments);
  var alias:Array = arguments; alias.push(99); Recorder.record("alias-push", a, b, arguments);
  arguments.length = 0; Recorder.record("length-write", a, b, alias);
 }
}}

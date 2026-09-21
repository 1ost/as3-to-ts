package cycle { import cycle.B; public class A { public function A() {} public function accept(value:*):* {var peer:B=value; return peer;} public function empty():* {var peer:B; return peer;} } }

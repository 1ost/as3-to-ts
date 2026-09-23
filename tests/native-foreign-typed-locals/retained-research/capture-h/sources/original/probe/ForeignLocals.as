package probe { import foreign.Peer;
public class ForeignLocals {
 public function ForeignLocals() {}
 public function empty():* {var item:Peer; return item;}
 public function initialize(value:*):* {var item:Peer=value; return item;}
 public function assignment(initial:*,value:*):* {var item:Peer=initial; var raw:*=(item=value); return [raw,item];}
 public function chain(initial:*,value:*):* {var item:Peer=initial; var outer:*="before"; var raw:*=(outer=item=value); return [raw,item,outer];}
 public function failure(initial:*,value:*,observer:*):* {var item:Peer=initial; try {item=value;} catch(error:*) {return [item,observer.error(error)];} return [item,"no-error"];}
 public function failedInit(value:*,observer:*):* {try {var item:Peer=value;} catch(error:*) {return [item,observer.error(error)];} return [item,"no-error"];}
 public function expression(box:*):* {var item:Peer=box.next(); return item;}
 public function catchRethrow(value:*,observer:*):* {var item:Peer;try {item=value;}catch(error:*) {observer.seen(error);throw error;}return item;}
 public function self(value:*):* {var item:ForeignLocals=value; return item;}
}}


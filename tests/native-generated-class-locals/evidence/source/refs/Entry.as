package refs { import refs.Peer;
public class Entry {
 public function Entry() {}
 public function empty():* {var item:Peer;return item;}
 public function initialize(value:*):* {var item:Peer=value;return item;}
 public function store(initial:*,value:*):* {var item:Peer=initial;var raw:*=(item=value);return [raw,item];}
 public function chain(initial:*,value:*):* {var first:Peer=initial;var second:Peer=initial;var raw:*=(first=second=value);return [raw,first,second];}
 public function failure(initial:*,value:*,observer:*):* {var item:Peer=initial;try{item=value;}catch(error:*){return [item,observer.error(error)];}return [item,"no-error"];}
 public function failedInit(value:*,observer:*):* {try{var item:Peer=value;}catch(error:*){return [item,observer.error(error)];}return [item,"no-error"];}
 public function expression(box:*):* {var item:Peer=box.next();return item;}
 public function self(value:*):* {var item:Entry=value;return item;}
 public function skipped(flag:*):* {if(flag){var item:Peer;}return item;}
 public function repeated(value:*):* {var item:Peer=value;var item:Peer;return item;}
 public function readBeforeDeclaration():* {var before:*=item;var item:Peer;return [before,item];}
 public function catchRethrow(value:*,observer:*):* {var item:Peer;try{item=value;}catch(error:*){observer.seen(error);throw error;}return item;}
}}


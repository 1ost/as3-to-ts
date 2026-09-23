package probe { public class DeclarationOrder { private var pf:*=11; protected var qf:*=22; public var uf:*=33; private function pm():*{return "private-method";} protected function qm():*{return "protected-method";} public function um():*{return "public-method";} private function throwInit():*{throw "init";} public function DeclarationOrder(){super();}
public function case0():*{var before:*=pf; var pf:*="local"; return [before,pf,this.pf];}
public function case1():*{var pf:*=pf; return [pf,this.pf];}
public function case2():*{if(false){var pf:*="local";} return [pf,this.pf];}
public function case3():*{var before:*=pf; if(false){var pf:*="local";} return [before,pf,this.pf];}
public function case4():*{if(true){var pf:*="local";} return [pf,this.pf];}
public function case5():*{var before:*=pf; if(true){var pf:*="local";} return [before,pf,this.pf];}
public function case6():*{var before:*=qf; var qf:*="local"; return [before,qf,this.qf];}
public function case7():*{var qf:*=qf; return [qf,this.qf];}
public function case8():*{if(false){var qf:*="local";} return [qf,this.qf];}
public function case9():*{var before:*=qf; if(false){var qf:*="local";} return [before,qf,this.qf];}
public function case10():*{if(true){var qf:*="local";} return [qf,this.qf];}
public function case11():*{var before:*=qf; if(true){var qf:*="local";} return [before,qf,this.qf];}
public function case12():*{var before:*=uf; var uf:*="local"; return [before,uf,this.uf];}
public function case13():*{var uf:*=uf; return [uf,this.uf];}
public function case14():*{if(false){var uf:*="local";} return [uf,this.uf];}
public function case15():*{var before:*=uf; if(false){var uf:*="local";} return [before,uf,this.uf];}
public function case16():*{if(true){var uf:*="local";} return [uf,this.uf];}
public function case17():*{var before:*=uf; if(true){var uf:*="local";} return [before,uf,this.uf];}
public function case18():*{var before:*=pm; var pm:*="local"; return [before===this.pm,pm];}
public function case19():*{var before:*=pm(); var pm:*="local"; return [before,pm];}
public function case20():*{var pm:*=pm; return [pm===this.pm,typeof pm];}
public function case21():*{var before:*=pm; if(false){var pm:*="local";} return [before===this.pm,pm];}
public function case22():*{if(false){var pm:*="local";} return [pm,this.pm()];}
public function case23():*{var before:*=qm; var qm:*="local"; return [before===this.qm,qm];}
public function case24():*{var before:*=qm(); var qm:*="local"; return [before,qm];}
public function case25():*{var qm:*=qm; return [qm===this.qm,typeof qm];}
public function case26():*{var before:*=qm; if(false){var qm:*="local";} return [before===this.qm,qm];}
public function case27():*{if(false){var qm:*="local";} return [qm,this.qm()];}
public function case28():*{var before:*=um; var um:*="local"; return [before===this.um,um];}
public function case29():*{var before:*=um(); var um:*="local"; return [before,um];}
public function case30():*{var um:*=um; return [um===this.um,typeof um];}
public function case31():*{var before:*=um; if(false){var um:*="local";} return [before===this.um,um];}
public function case32():*{if(false){var um:*="local";} return [um,this.um()];}
public function case33(pf:*):*{return [pf,this.pf];}
public function case34():*{var before:*=pf; var inside:*; try{throw "caught";}catch(pf:*){inside=pf;} return [before,inside,pf];}
public function case35():*{try{throw "caught";}catch(e:*){var pf:*="local";}return [pf,this.pf];}
public function case36(qf:*):*{return [qf,this.qf];}
public function case37():*{var before:*=qf; var inside:*; try{throw "caught";}catch(qf:*){inside=qf;} return [before,inside,qf];}
public function case38():*{try{throw "caught";}catch(e:*){var qf:*="local";}return [qf,this.qf];}
public function case39(uf:*):*{return [uf,this.uf];}
public function case40():*{var before:*=uf; var inside:*; try{throw "caught";}catch(uf:*){inside=uf;} return [before,inside,uf];}
public function case41():*{try{throw "caught";}catch(e:*){var uf:*="local";}return [uf,this.uf];}
public function case42():*{var before:*=pf,pf:*="local"; return [before,pf];}
public function case43():*{var pf:*="local",after:*=pf; return [after,pf];}
public function case44():*{var pf:*="local";var inside:*;try{throw "caught";}catch(pf:*){inside=pf;}return [inside,pf,this.pf];}
public function case45():*{var before:*;try{throw "caught";}catch(pf:*){before=pf;}var between:*=pf;var pf:*="local";return [before,between,pf];}
public function case46():*{var before:*=pf;try{throw "caught";}catch(e:*){var pf:*="local";}return [before,pf];}
public function case47():*{var before:*=pf;if(false){var pf:*="first";}else{pf="second";}return [before,pf,this.pf];}
public function case48():*{if(true){var pf:*=pf;}return [pf,this.pf];}
public function case49(pf:*):*{var before:*=pf;var pf:*="local";return [before,pf,this.pf];}
public function case50(flag:*):*{if(flag){var pf:*="local";}return [pf,typeof pf,this.pf];}
public function case51(flag:*):*{var before:*=pf;if(flag){var pf:*="local";}return [before,pf,typeof pf,this.pf];}
public function case52(flag:*):*{if(flag){var pf:*="local";}return [pf,typeof pf,this.pf];}
public function case53(flag:*):*{var before:*=pf;if(flag){var pf:*="local";}return [before,pf,typeof pf,this.pf];}
public function case54(flag:*):*{if(flag){var qf:*="local";}return [qf,typeof qf,this.qf];}
public function case55(flag:*):*{var before:*=qf;if(flag){var qf:*="local";}return [before,qf,typeof qf,this.qf];}
public function case56(flag:*):*{if(flag){var qf:*="local";}return [qf,typeof qf,this.qf];}
public function case57(flag:*):*{var before:*=qf;if(flag){var qf:*="local";}return [before,qf,typeof qf,this.qf];}
public function case58(flag:*):*{if(flag){var uf:*="local";}return [uf,typeof uf,this.uf];}
public function case59(flag:*):*{var before:*=uf;if(flag){var uf:*="local";}return [before,uf,typeof uf,this.uf];}
public function case60(flag:*):*{if(flag){var uf:*="local";}return [uf,typeof uf,this.uf];}
public function case61(flag:*):*{var before:*=uf;if(flag){var uf:*="local";}return [before,uf,typeof uf,this.uf];}
public function case62():*{if(false){var pm:*="local";}return [typeof pm,pm===this.pm];}
public function case63(flag:*):*{var before:*=pm;if(flag){var pm:*="local";}return [before===this.pm,typeof pm,pm===this.pm];}
public function case64(flag:*):*{var before:*=pm;if(flag){var pm:*="local";}return [before===this.pm,typeof pm,pm===this.pm];}
public function case65():*{if(false){var qm:*="local";}return [typeof qm,qm===this.qm];}
public function case66(flag:*):*{var before:*=qm;if(flag){var qm:*="local";}return [before===this.qm,typeof qm,qm===this.qm];}
public function case67(flag:*):*{var before:*=qm;if(flag){var qm:*="local";}return [before===this.qm,typeof qm,qm===this.qm];}
public function case68():*{if(false){var um:*="local";}return [typeof um,um===this.um];}
public function case69(flag:*):*{var before:*=um;if(flag){var um:*="local";}return [before===this.um,typeof um,um===this.um];}
public function case70(flag:*):*{var before:*=um;if(flag){var um:*="local";}return [before===this.um,typeof um,um===this.um];}
public function case71():*{var before:*=pf;var pf:*;return [before,pf,typeof pf,this.pf];}
public function case72(pf:*):*{var before:*=pf;var pf:*="local";return [before,pf,this.pf];}
public function case73():*{var before:*=pf;try{var pf:*=this.throwInit();}catch(e:*){}return [before,pf,typeof pf,this.pf];}
public function case74():*{var before:*=qf;var qf:*;return [before,qf,typeof qf,this.qf];}
public function case75(qf:*):*{var before:*=qf;var qf:*="local";return [before,qf,this.qf];}
public function case76():*{var before:*=qf;try{var qf:*=this.throwInit();}catch(e:*){}return [before,qf,typeof qf,this.qf];}
public function case77():*{var before:*=uf;var uf:*;return [before,uf,typeof uf,this.uf];}
public function case78(uf:*):*{var before:*=uf;var uf:*="local";return [before,uf,this.uf];}
public function case79():*{var before:*=uf;try{var uf:*=this.throwInit();}catch(e:*){}return [before,uf,typeof uf,this.uf];}
public function case80():*{var before:*=pm;var pm:*;return [before===this.pm,typeof pm,pm===this.pm];}
public function case81(pm:*):*{var before:*=pm;var pm:*="local";return [before,pm];}
public function case82():*{var before:*=pm;try{var pm:*=this.throwInit();}catch(e:*){}return [before===this.pm,typeof pm,pm===this.pm];}
public function case83():*{var before:*=qm;var qm:*;return [before===this.qm,typeof qm,qm===this.qm];}
public function case84(qm:*):*{var before:*=qm;var qm:*="local";return [before,qm];}
public function case85():*{var before:*=qm;try{var qm:*=this.throwInit();}catch(e:*){}return [before===this.qm,typeof qm,qm===this.qm];}
public function case86():*{var before:*=um;var um:*;return [before===this.um,typeof um,um===this.um];}
public function case87(um:*):*{var before:*=um;var um:*="local";return [before,um];}
public function case88():*{var before:*=um;try{var um:*=this.throwInit();}catch(e:*){}return [before===this.um,typeof um,um===this.um];}
}}

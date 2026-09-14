package consumer { import foreign.visible; import wildpkg.*; public class Subject { public function Subject(){}
public static function builtinObject():* {return typeof Object;}
public static function shadowObject():* {var Object:*=7;return typeof Object;}
public static function builtinArray():* {return typeof Array;}
public static function shadowArray():* {var Array:*=7;return typeof Array;}
public static function builtinNumber():* {return typeof Number;}
public static function shadowNumber():* {var Number:*=7;return typeof Number;}
public static function builtinString():* {return typeof String;}
public static function shadowString():* {var String:*=7;return typeof String;}
public static function builtinBoolean():* {return typeof Boolean;}
public static function shadowBoolean():* {var Boolean:*=7;return typeof Boolean;}
public static function builtinFunction():* {return typeof Function;}
public static function shadowFunction():* {var Function:*=7;return typeof Function;}
public static function builtinClass():* {return typeof Class;}
public static function shadowClass():* {var Class:*=7;return typeof Class;}
public static function builtinint():* {return typeof int;}
public static function shadowint():* {var int:*=7;return typeof int;}
public static function builtinuint():* {return typeof uint;}
public static function shadowuint():* {var uint:*=7;return typeof uint;}
public static function identityintNumber():* {return typeof (int === Number ? function():void{} : null);}
public static function identityuintNumber():* {return typeof (uint === Number ? function():void{} : null);}
public static function identityintuint():* {return typeof (int === uint ? function():void{} : null);}
public static function identityClassFunction():* {return typeof (Class === Function ? function():void{} : null);}
public static function classPeer():* {return typeof Peer;}
public static function classvisible():* {return typeof visible;}
public static function classwild():* {return typeof wild;}
public static function parenthesized():* {return typeof (Class);}
public static function nested():* {return typeof (true ? int : uint);}
public static function memberName():* {var value:*={Class:7};return typeof value.Class;}
public static function undefinedLocal():* {var undefined:*=7;return typeof undefined;}
public static function catchClass():* {try{throw 7;}catch(Class:*){return typeof Class;}}
}}

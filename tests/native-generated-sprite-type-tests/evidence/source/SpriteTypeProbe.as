package {import cases.SpriteTests;import flash.display.Sprite;import flash.display.Shape;import flash.display.MovieClip;public class SpriteTypeProbe {
 public function snapshot():Object {var s:SpriteTests=new SpriteTests(),sprite:Sprite=new Sprite(),shape:Shape=new Shape(),movie:MovieClip=new MovieClip();var rows:Array=[];
 rows.push({id:"sprite",value:[s.test(sprite),s.cast(sprite)===sprite]});
 rows.push({id:"movieclip",value:[s.test(movie),s.cast(movie)===movie]});
 rows.push({id:"shape",value:[s.test(shape),s.cast(shape)===null]});
 rows.push({id:"nullish",value:[s.test(null),s.test(undefined),s.cast(null)===null,s.cast(undefined)===null]});
 rows.push({id:"primitive",value:[s.test(1),s.test("x"),s.test(true),s.cast(1)===null,s.cast("x")===null,s.cast(true)===null]});
 rows.push({id:"object-class",value:[s.test({}),s.test(Sprite),s.cast({})===null,s.cast(Sprite)===null]});
 rows.push({id:"call-valid",value:[s.fromCall(sprite)===sprite,s.calls]});
 rows.push({id:"call-invalid",value:[s.fromCall(shape)===null,s.calls]});
 return {ready:true,failure:"",observations:rows};}
}}

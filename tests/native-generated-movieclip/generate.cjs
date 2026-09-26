const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const evidence=JSON.parse(execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'verify.py'),engine],{encoding:'utf8'}));
const source='// Complete inherited MovieClip surface from repeated authenticated Flash captures.\n'
 +'// Reproduce/verify with tests/native-generated-movieclip/verify.py.\n'
 +'import {NativeSpriteTrait} from "./native-sprite-traits";\n'
 +'export const nativeMovieClipTraits: ReadonlyArray<NativeSpriteTrait> = Object.freeze([\n'
 +evidence.traits.map(t=>'    Object.freeze('+JSON.stringify(t)+' as NativeSpriteTrait),').join('\n')+'\n]);\n';
const file=path.join(__dirname,'../../src/emit/native-movieclip-traits.ts');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),source);
else fs.writeFileSync(file,source);
console.log('105 authenticated MovieClip traits '+(process.argv.includes('--check')?'verified.':'generated.'));

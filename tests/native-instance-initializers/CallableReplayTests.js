const assert=require('assert'),fs=require('fs'),path=require('path'),ts=require('typescript');
const {fixture}=require('./callable-fixture');
require('./verify-evidence');
const input=path.join(__dirname,'replay-original/replay');
const sources=Object.fromEntries(fs.readdirSync(input).map(file=>['replay.'+path.basename(file,'.as'),fs.readFileSync(path.join(input,file),'utf8')]));
const flash=JSON.parse(fs.readFileSync(path.join(__dirname,'replay-original/flash.json')));
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
    const {get}=fixture(target,sources),Subject=get('Subject'),Failed=get('Failed'),Journal=get('Journal');
    const subject=new Subject();subject.stage=42;
    Journal.attempt('completed',subject,Subject);Journal.rows.push('completed-value:'+subject.stage);
    for(let i=0;i<2;i++){
        try{new Failed();}catch(error){Journal.rows.push('failure:'+(error===Journal.failure));}
        Journal.attempt('failed',Journal.leaked,Failed);Journal.rows.push('failed-value:'+Journal.leaked.ready);
    }
    assert.deepEqual(Array.from(Journal.rows),flash);
    console.log('Original Flash'+flash.length+' active/completed/failed replay and valid source-base observations matched '+(target===ts.ScriptTarget.ES5?'ES5':'ES2015'));
}

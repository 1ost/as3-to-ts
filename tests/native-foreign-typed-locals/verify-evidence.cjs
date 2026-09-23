const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const file=path.join(__dirname,'evidence-files.json');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),"1c7053cfbbcb927bc18e81d2cc7ee7882d366d1d9dfcb823188cc259b7ba1371");
cp.execFileSync(process.env.PYTHON,[path.join(__dirname,'verify-evidence.py')],{stdio:'pipe',windowsHide:true});

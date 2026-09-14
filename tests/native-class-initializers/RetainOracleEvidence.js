const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
assert(process.argv[2], 'Pass the OP2 checkout containing the independently captured oracle artifacts');
const source = path.resolve(process.argv[2], 'as3-to-layaair-porting-kit/.local/tweenmax-init-review');
const oracle = path.join(__dirname, 'oracle');
const groups = {
    '': ['InitOracle.as', 'init/Log.as', 'init/Base.as', 'init/Subject.as', 'flash.json', 'evidence.json', 'capture.cjs'],
    publication: ['PublicationOracle.as', 'lifecycle/Journal.as', 'lifecycle/First.as', 'lifecycle/Second.as', 'lifecycle/Failure.as', 'flash.json', 'provenance.json', 'capture.cjs'],
    'class-reads': ['ReadsOracle.as', 'reads/Journal.as', 'reads/CastTarget.as', 'reads/IsTarget.as', 'reads/NewTarget.as', 'flash.json', 'provenance.json', 'capture.cjs'],
    'cycles-errors': ['CycleOracle.as', 'probe/Log.as', 'probe/A.as', 'probe/B.as', 'probe/Failure.as', 'flash.json', 'commands.json', 'capture.cjs'],
};
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [], swfs = [];
for (const [group, names] of Object.entries(groups)) {
    for (const name of names) {
        const relative = [group, name].filter(Boolean).join('/');
        const from = path.join(source, relative), to = path.join(oracle, relative);
        fs.mkdirSync(path.dirname(to), {recursive: true}); fs.copyFileSync(from, to);
        files.push({path: relative, sha256: hash(to)});
    }
    const swf = path.join(source, group, 'oracle.swf');
    swfs.push({group: group || 'initial-order', sourcePath: swf, sha256: hash(swf)});
}
const receipt = {schema: 1, scope: 'Independent actual Flash class initialization captures; no application readiness',
    retentionScriptSHA256: hash(__filename), files, swfs};
const file = path.join(oracle, 'receipt.json'); fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
console.log(hash(file));

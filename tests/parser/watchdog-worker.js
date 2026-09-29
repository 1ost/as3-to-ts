'use strict';

const path = require('path');
const parse = require(path.join(process.argv[2], 'parse.js')).default;

const source = Buffer.from(process.argv[3], 'base64').toString('utf8');
try {
    parse('C:\\watchdog\\Malformed.as', source);
    process.stdout.write(JSON.stringify({ok: true}));
} catch (error) {
    process.stdout.write(JSON.stringify({
        ok: false,
        name: error.name,
        code: error.code,
        path: error.path,
        line: error.line,
        column: error.column,
        message: error.message,
    }));
}

"use strict";
const {inspectSourceIncludes}=require('../lib/source-includes.js');
try {process.stdout.write(JSON.stringify(inspectSourceIncludes(process.argv[2],process.argv.slice(3)))+'\n');}
catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { knownEmissionIssues, knownSourceIssues } = require('./admission');
const { sha256Bytes } = require('./canonical');

const MAX_STDIN_BYTES = 2 * 1024 * 1024;

readStdin().then(run).then(result => {
  process.stdout.write(JSON.stringify(result));
}).catch(error => {
  process.stdout.write(JSON.stringify({
    classification: 'unverified_scaffold',
    fatal: normalizeError(error),
    workerStatus: 'failed'
  }));
  process.exitCode = 2;
});

async function run(request) {
  requireString(request.toolRoot, 'toolRoot');
  requireString(request.sourceBase64, 'sourceBase64');
  requireString(request.sourceSha256, 'sourceSha256');
  requireString(request.logicalPath, 'logicalPath');
  if (!Number.isInteger(request.sourceSize) || request.sourceSize < 0) throw new Error('sourceSize is required');
  const sourceBytes = Buffer.from(request.sourceBase64, 'base64');
  if (sourceBytes.length !== request.sourceSize || sha256Bytes(sourceBytes) !== request.sourceSha256) {
    throw new Error('worker source identity does not match authenticated request');
  }
  const source = sourceBytes.toString('utf8');
  const sourceIssues = knownSourceIssues(source);
  const upstreamBlockers = sourceIssues.filter(issue => issue.code.startsWith('upstream_'));
  const base = {
    admission: { reasons: sourceIssues, status: 'rejected' },
    classification: 'unverified_scaffold',
    emit: { status: 'not_run' },
    output: { materialized: false, published: false },
    parse: { status: 'not_run' },
    syntax: { diagnostics: [], status: 'not_run' },
    type: { diagnostics: [], status: 'not_run' },
    workerStatus: 'completed'
  };
  if (upstreamBlockers.length) {
    base.parse.status = 'blocked_known_upstream';
    return base;
  }

  const parse = require(path.join(request.toolRoot, 'lib/parse/index')).default;
  const emit = require(path.join(request.toolRoot, 'lib/emit/emitter')).emit;
  const ts = require(path.join(request.toolRoot, 'node_modules/typescript'));
  let ast;
  try {
    ast = parse(path.posix.basename(request.logicalPath), source);
    base.parse.status = 'passed';
  } catch (error) {
    base.parse = { error: normalizeError(error), status: 'failed' };
    base.admission.reasons = appendReason(base.admission.reasons, 'parse_failed');
    return base;
  }

  let output;
  try {
    output = emit(ast, source, {
      customVisitors: [],
      definitionsByNamespace: request.definitionsByNamespace || {},
      lineSeparator: '\n',
      useNamespaces: false
    }).replace(/\r\n/g, '\n');
    base.emit.status = 'passed';
    base.output = {
      materialized: false,
      published: false,
      sha256: sha256Bytes(Buffer.from(output, 'utf8')),
      size: Buffer.byteLength(output, 'utf8')
    };
  } catch (error) {
    base.emit = { error: normalizeError(error), status: 'failed' };
    base.admission.reasons = appendReason(base.admission.reasons, 'emit_failed');
    return base;
  }

  const gates = inspectTypeScript(ts, output);
  base.syntax = gates.syntax;
  base.type = gates.type;
  let reasons = base.admission.reasons.concat(knownEmissionIssues(output));
  if (base.syntax.status !== 'passed') reasons = appendReason(reasons, 'syntax_failed');
  if (base.type.status !== 'passed') reasons = appendReason(reasons, 'type_failed');
  reasons = dedupeReasons(reasons);
  base.admission = {
    reasons,
    status: reasons.length ? 'rejected' : 'unverified_scaffold'
  };
  return base;
}

function inspectTypeScript(ts, output) {
  const options = {
    experimentalDecorators: true,
    module: ts.ModuleKind.CommonJS,
    noEmit: true,
    noResolve: true,
    target: ts.ScriptTarget.ES5
  };
  const virtualName = 'candidate.ts';
  const host = ts.createCompilerHost(options, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  host.getCurrentDirectory = () => '/hardened-corpus';
  host.getCanonicalFileName = fileName => fileName.toLowerCase();
  host.getSourceFile = (fileName, languageVersion, onError) => {
    if (path.basename(fileName) === virtualName) {
      return ts.createSourceFile(virtualName, output, languageVersion, true);
    }
    return originalGetSourceFile(fileName, languageVersion, onError);
  };
  host.fileExists = fileName => path.basename(fileName) === virtualName || originalFileExists(fileName);
  host.readFile = fileName => path.basename(fileName) === virtualName ? output : originalReadFile(fileName);
  host.writeFile = () => { throw new Error('hardened corpus type gate forbids writes'); };
  const program = ts.createProgram([virtualName], options, host);
  const syntaxDiagnostics = program.getSyntacticDiagnostics();
  const syntax = diagnosticGate(ts, syntaxDiagnostics);
  const type = syntax.status === 'passed'
    ? diagnosticGate(ts, program.getSemanticDiagnostics())
    : { diagnostics: [], status: 'not_run' };
  return { syntax, type };
}

function diagnosticGate(ts, diagnostics) {
  const normalized = diagnostics.slice(0, 40).map(diagnostic => {
    const record = {
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
    };
    if (diagnostic.file && Number.isInteger(diagnostic.start)) {
      const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      record.character = location.character + 1;
      record.line = location.line + 1;
    }
    return record;
  });
  return {
    diagnosticCount: diagnostics.length,
    diagnostics: normalized,
    diagnosticsTruncated: diagnostics.length > normalized.length,
    status: diagnostics.length ? 'failed' : 'passed'
  };
}

function appendReason(reasons, code) {
  return dedupeReasons(reasons.concat([{ code }]));
}

function dedupeReasons(reasons) {
  const byCode = new Map();
  reasons.forEach(reason => byCode.set(reason.code, reason));
  return Array.from(byCode.values()).sort((left, right) => left.code.localeCompare(right.code));
}

function normalizeError(error) {
  const name = error && error.name ? String(error.name) : 'Error';
  let message = error && error.message ? String(error.message) : String(error);
  message = message.replace(/[A-Za-z]:\\[^\r\n]+/g, '<absolute-path>').replace(/\/[\w./-]+/g, '<absolute-path>');
  return { message: message.slice(0, 1000), name };
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value) throw new Error(`${name} is required`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    process.stdin.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_STDIN_BYTES) {
        reject(new Error('worker input exceeds limit'));
        process.stdin.destroy();
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

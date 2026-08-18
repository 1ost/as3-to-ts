#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { compareUtf8, sha256Bytes, sha256Json, stringify } = require('./canonical');
const { EXPECTED_BLEACH_CENSUS, loadAuthority, publicEntry, relevantDefinitions } = require('./manifest');

const SCHEMA = 'bleach-hardened-corpus-checkpoint@1';
const DEFAULT_GRAPH = 'as3-to-layaair-porting-kit/generated/dependency-graph/bleach-as3-dependency-graph.json';
const DEFAULT_CENSUS = 'as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json';
const EXPECTED_CONVERTER_BASE_SHA = 'fa0b5151ab82758511ddd4b464f0c05b80e06da7';
const EXPECTED_PACKAGE_LOCK_SHA256 = 'b574fbcbcd8d427b2404d4016d9fd280ef0eb576781e575bd93fc1e5b29e0cf7';
const OUTPUT_POLICY = {
  generatedTypeScriptMaterialized: false,
  generatedTypeScriptPublished: false,
  legacyOutputClassification: 'unverified_scaffold'
};

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

async function main(argv) {
  const options = parseArguments(argv, process.env);
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }
  const summary = await runHarness(options);
  process.stdout.write(`${stringify(summary)}\n`);
}

async function runHarness(options) {
  const harnessRoot = fs.realpathSync(path.resolve(options.harnessRoot || path.join(__dirname, '..', '..')));
  const converterRoot = fs.realpathSync(path.resolve(options.converterRoot || harnessRoot));
  const bleachRoot = options.bleachRoot && fs.realpathSync(path.resolve(options.bleachRoot));
  if (!bleachRoot) throw new Error('Bleach root is required via --bleach-root or BLEACH_REPO_ROOT');
  const checkpointPath = path.resolve(options.checkpointPath || '');
  if (!options.checkpointPath) throw new Error('--checkpoint is required');
  assertCheckpointOutsideBleachRoot(checkpointPath, bleachRoot);
  const timeoutMs = boundedInteger(options.timeoutMs, 1, 600000, 'timeout-ms');
  const maxOutputBytes = boundedInteger(options.maxOutputBytes, 1, 16 * 1024 * 1024, 'max-output-bytes');
  const identity = verifyToolIdentity(converterRoot, options.expectedConverterBaseSha || EXPECTED_CONVERTER_BASE_SHA, harnessRoot);
  const authority = loadAuthority(
    bleachRoot,
    options.graphPath || DEFAULT_GRAPH,
    options.censusPath || DEFAULT_CENSUS,
    options.expectedCensus || EXPECTED_BLEACH_CENSUS,
    options.expectedDependencyGraphSha256
  );
  const runPolicy = Object.assign({}, OUTPUT_POLICY, {
    dependencyGraphSha256: authority.dependencyGraphPolicySha256
  });
  const config = {
    commonjs: true,
    maxOutputBytes,
    timeoutMs,
    workerProtocol: 1
  };
  const header = {
    authority: {
      census: authority.censusAuthority,
      censusSha256: authority.censusSha256,
      dependencyGraphPolicySha256: authority.dependencyGraphPolicySha256,
      dependencyGraphSha256: authority.dependencyGraphSha256,
      dependencyGraphSummary: authority.dependencyGraphSummary,
      dependencyManifestSha256: authority.manifestSha256,
      sourceManifestSha256: authority.sourceManifestSha256
    },
    classification: 'unverified_scaffold',
    config,
    kind: 'header',
    policy: runPolicy,
    resumeSeal: sha256Json({ authority: authority.semanticManifest, config, identity }),
    schema: SCHEMA,
    tool: identity
  };

  const state = loadOrCreateCheckpoint(checkpointPath, header, authority.entries);
  if (state.sealed) return state.summary;
  if (typeof options.afterAuthorityLoaded === 'function') await options.afterAuthorityLoaded(authority);

  for (let index = state.completedCount; index < authority.entries.length; index++) {
    const entry = authority.entries[index];
    recheckSourceIdentity(entry);
    const source = entry.sourceBytes.toString('utf8');
    const definitions = relevantDefinitions(source, authority.definitionsByModule[entry.module]);
    const subprocess = await runWorker({
      definitionsByNamespace: definitions,
      logicalPath: entry.logicalPath,
      sourceBase64: entry.sourceBytes.toString('base64'),
      sourceSha256: entry.sourceSha256,
      sourceSize: entry.sourceSize,
      toolRoot: converterRoot
    }, {
      maxOutputBytes,
      timeoutMs,
      workerPath: path.join(__dirname, 'worker.js')
    });
    recheckSourceIdentity(entry);
    const record = buildRecord(entry, subprocess, sha256Bytes(Buffer.from(state.lines[state.lines.length - 1], 'utf8')), runPolicy);
    appendCanonicalLine(checkpointPath, state.lines, record);
  }

  authority.entries.forEach(recheckSourceIdentity);
  const counts = countResults(state.lines.slice(1).map(line => JSON.parse(line)));
  const content = `${state.lines.join('\n')}\n`;
  const seal = {
    checkpointContentSha256: sha256Bytes(Buffer.from(content, 'utf8')),
    classification: 'unverified_scaffold',
    fileCount: authority.entries.length,
    kind: 'seal',
    policy: runPolicy,
    previousLineSha256: sha256Bytes(Buffer.from(state.lines[state.lines.length - 1], 'utf8')),
    resultCounts: counts,
    resumeSeal: header.resumeSeal,
    schema: SCHEMA
  };
  appendCanonicalLine(checkpointPath, state.lines, seal);
  return summaryFromSeal(checkpointPath, seal);
}

function recheckSourceIdentity(entry) {
  const stat = fs.lstatSync(entry.absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`source identity changed after authority capture: ${entry.logicalPath}`);
  const real = fs.realpathSync(entry.absolutePath);
  if (path.resolve(real).toLowerCase() !== path.resolve(entry.absolutePath).toLowerCase()) {
    throw new Error(`source path changed after authority capture: ${entry.logicalPath}`);
  }
  const current = fs.readFileSync(entry.absolutePath);
  const currentSha256 = sha256Bytes(current);
  if (current.length !== entry.sourceSize || currentSha256 !== entry.sourceSha256) {
    throw new Error(`source bytes changed after authority capture: ${entry.logicalPath}`);
  }
}

function buildRecord(entry, subprocess, previousLineSha256, policy) {
  const base = {
    authority: publicEntry(entry),
    classification: 'unverified_scaffold',
    kind: 'file',
    path: entry.logicalPath,
    policy,
    previousLineSha256,
    schema: SCHEMA,
    subprocess: {
      exitCode: subprocess.exitCode,
      outputBytes: subprocess.outputBytes,
      status: subprocess.status,
      stderrBytes: subprocess.stderrBytes,
      stderrSha256: subprocess.stderrSha256
    }
  };
  if (subprocess.status === 'completed' && subprocess.result && subprocess.result.workerStatus === 'completed') {
    base.admission = subprocess.result.admission;
    base.emit = subprocess.result.emit;
    base.output = subprocess.result.output;
    base.parse = subprocess.result.parse;
    base.syntax = subprocess.result.syntax;
    base.type = subprocess.result.type;
  } else {
    base.admission = { reasons: [{ code: `subprocess_${subprocess.status}` }], status: 'rejected' };
    base.emit = { status: 'not_run' };
    base.output = { materialized: false, published: false };
    base.parse = { status: 'not_run' };
    base.syntax = { diagnostics: [], status: 'not_run' };
    base.type = { diagnostics: [], status: 'not_run' };
  }
  return base;
}

function runWorker(request, limits) {
  return new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [limits.workerPath], {
      cwd: path.dirname(limits.workerPath),
      env: minimalEnvironment(process.env),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let capturedBytes = 0;
    let observedBytes = 0;
    let forcedStatus = null;
    let settled = false;
    const timer = setTimeout(() => {
      forcedStatus = 'timeout';
      child.kill('SIGKILL');
    }, limits.timeoutMs);

    function collect(current, chunk) {
      observedBytes += chunk.length;
      if (observedBytes > limits.maxOutputBytes && !forcedStatus) {
        forcedStatus = 'output_cap_exceeded';
        child.kill('SIGKILL');
      }
      const remaining = Math.max(0, limits.maxOutputBytes - capturedBytes);
      const retained = chunk.slice(0, remaining);
      capturedBytes += retained.length;
      return retained.length ? Buffer.concat([current, retained]) : current;
    }
    child.stdout.on('data', chunk => { stdout = collect(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = collect(stderr, chunk); });
    child.stdin.on('error', () => {
      if (settled) return;
      if (!forcedStatus) {
        forcedStatus = 'protocol_failed';
        child.kill('SIGKILL');
      }
    });
    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(subprocessResult('spawn_failed', null, stdout, stderr, null, observedBytes));
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      let result = null;
      let status = forcedStatus || (code === 0 ? 'completed' : 'worker_failed');
      if (!forcedStatus) {
        try {
          result = JSON.parse(stdout.toString('utf8'));
          if (result.workerStatus !== 'completed') status = 'worker_failed';
        } catch (_) {
          status = 'protocol_failed';
        }
      }
      const deterministicObservedBytes = status === 'output_cap_exceeded' ? limits.maxOutputBytes + 1 : observedBytes;
      resolve(subprocessResult(status, code, stdout, stderr, result, deterministicObservedBytes));
    });
    child.stdin.end(Buffer.from(JSON.stringify(request), 'utf8'));
  });
}

function subprocessResult(status, exitCode, stdout, stderr, result, observedBytes) {
  return {
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    outputBytes: observedBytes,
    result,
    status,
    stderrBytes: stderr.length,
    stderrSha256: sha256Bytes(stderr)
  };
}

function loadOrCreateCheckpoint(checkpointPath, expectedHeader, entries) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  if (!fs.existsSync(checkpointPath)) {
    const line = stringify(expectedHeader);
    const descriptor = fs.openSync(checkpointPath, 'wx');
    try {
      fs.writeSync(descriptor, `${line}\n`, null, 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    return { completedCount: 0, lines: [line], sealed: false };
  }
  const raw = fs.readFileSync(checkpointPath, 'utf8');
  if (!raw.endsWith('\n')) throw new Error('checkpoint is truncated: missing final LF');
  const lines = raw.slice(0, -1).split('\n');
  if (!lines.length || !lines[0]) throw new Error('checkpoint is empty');
  const records = lines.map((line, index) => {
    let parsed;
    try { parsed = JSON.parse(line); } catch (_) { throw new Error(`checkpoint line ${index + 1} is not JSON`); }
    if (stringify(parsed) !== line) throw new Error(`checkpoint line ${index + 1} is not canonical JSON`);
    return parsed;
  });
  if (stringify(expectedHeader) !== lines[0]) throw new Error('checkpoint header/resume seal does not match current authority and configuration');
  let completedCount = 0;
  for (let index = 1; index < records.length; index++) {
    const record = records[index];
    const expectedPrevious = sha256Bytes(Buffer.from(lines[index - 1], 'utf8'));
    if (record.previousLineSha256 !== expectedPrevious) throw new Error(`checkpoint hash chain breaks at line ${index + 1}`);
    if (record.kind === 'seal') {
      if (index !== records.length - 1) throw new Error('checkpoint seal must be final');
      if (completedCount !== entries.length || record.fileCount !== entries.length) throw new Error('checkpoint seal file count mismatch');
      const content = `${lines.slice(0, index).join('\n')}\n`;
      if (record.checkpointContentSha256 !== sha256Bytes(Buffer.from(content, 'utf8'))) throw new Error('checkpoint seal content hash mismatch');
      if (record.resumeSeal !== expectedHeader.resumeSeal) throw new Error('checkpoint seal authority mismatch');
      validateExactKeys(record, ['checkpointContentSha256', 'classification', 'fileCount', 'kind', 'policy', 'previousLineSha256', 'resultCounts', 'resumeSeal', 'schema'], 'checkpoint seal');
      if (record.schema !== SCHEMA || record.classification !== 'unverified_scaffold' || stringify(record.policy) !== stringify(expectedHeader.policy)) {
        throw new Error('checkpoint seal schema/policy mismatch');
      }
      const recomputedCounts = countResults(records.slice(1, index));
      if (stringify(record.resultCounts) !== stringify(recomputedCounts)) throw new Error('checkpoint seal resultCounts mismatch');
      return { completedCount, lines, sealed: true, summary: summaryFromSeal(checkpointPath, record) };
    }
    if (record.kind !== 'file') throw new Error(`unexpected checkpoint record kind at line ${index + 1}`);
    const expectedEntry = entries[completedCount];
    if (!expectedEntry || record.path !== expectedEntry.logicalPath) throw new Error(`checkpoint is not an exact sorted manifest prefix at line ${index + 1}`);
    validateFileRecord(record, expectedEntry, expectedHeader.config, expectedHeader.policy);
    completedCount++;
  }
  return { completedCount, lines, sealed: false };
}

function validateFileRecord(record, expectedEntry, config, policy) {
  validateExactKeys(record, ['admission', 'authority', 'classification', 'emit', 'kind', 'output', 'parse', 'path', 'policy', 'previousLineSha256', 'schema', 'subprocess', 'syntax', 'type'], `file record ${record.path}`);
  if (record.schema !== SCHEMA || record.classification !== 'unverified_scaffold' || stringify(record.policy) !== stringify(policy)) {
    throw new Error(`file record schema/policy mismatch for ${record.path}`);
  }
  if (stringify(record.authority) !== stringify(publicEntry(expectedEntry))) {
    throw new Error(`checkpoint full authority mismatch for ${record.path}`);
  }
  validateExactKeys(record.subprocess, ['exitCode', 'outputBytes', 'status', 'stderrBytes', 'stderrSha256'], `subprocess ${record.path}`);
  const subprocessStatuses = ['completed', 'output_cap_exceeded', 'protocol_failed', 'spawn_failed', 'timeout', 'worker_failed'];
  if (!subprocessStatuses.includes(record.subprocess.status)) throw new Error(`invalid subprocess status for ${record.path}`);
  if (!(record.subprocess.exitCode === null || Number.isInteger(record.subprocess.exitCode))) throw new Error(`invalid subprocess exitCode for ${record.path}`);
  if (!Number.isInteger(record.subprocess.outputBytes) || record.subprocess.outputBytes < 0 || record.subprocess.outputBytes > config.maxOutputBytes + 1) {
    throw new Error(`invalid subprocess outputBytes for ${record.path}`);
  }
  if (!Number.isInteger(record.subprocess.stderrBytes) || record.subprocess.stderrBytes < 0 || record.subprocess.stderrBytes > config.maxOutputBytes) {
    throw new Error(`invalid subprocess stderrBytes for ${record.path}`);
  }
  if (!/^[0-9a-f]{64}$/.test(record.subprocess.stderrSha256)) throw new Error(`invalid subprocess stderrSha256 for ${record.path}`);
  validateGate(record.parse, ['blocked_known_upstream', 'failed', 'not_run', 'passed'], 'parse', record.path);
  validateGate(record.emit, ['failed', 'not_run', 'passed'], 'emit', record.path);
  validateDiagnosticGate(record.syntax, 'syntax', record.path);
  validateDiagnosticGate(record.type, 'type', record.path);
  if (!record.output || record.output.materialized !== false || record.output.published !== false) throw new Error(`unsafe output policy for ${record.path}`);
  if (record.emit.status === 'passed') {
    if (!/^[0-9a-f]{64}$/.test(record.output.sha256) || !Number.isInteger(record.output.size) || record.output.size < 0) {
      throw new Error(`invalid output evidence for ${record.path}`);
    }
  } else if (record.output.sha256 !== undefined || record.output.size !== undefined) {
    throw new Error(`output evidence exists without successful emit for ${record.path}`);
  }
  if (!record.admission || !['rejected', 'unverified_scaffold'].includes(record.admission.status) || !Array.isArray(record.admission.reasons)) {
    throw new Error(`invalid admission record for ${record.path}`);
  }
  const reasonCodes = record.admission.reasons.map(reason => reason && reason.code);
  if (reasonCodes.some(code => typeof code !== 'string' || !code) || new Set(reasonCodes).size !== reasonCodes.length) {
    throw new Error(`invalid admission reasons for ${record.path}`);
  }
  if (JSON.stringify(reasonCodes.slice().sort(compareUtf8)) !== JSON.stringify(reasonCodes)) throw new Error(`unsorted admission reasons for ${record.path}`);
  if (record.admission.status === 'rejected' && !reasonCodes.length) throw new Error(`rejected admission lacks reason for ${record.path}`);
  if (record.subprocess.status !== 'completed') {
    if (record.parse.status !== 'not_run' || record.emit.status !== 'not_run' || record.syntax.status !== 'not_run' || record.type.status !== 'not_run' || record.admission.status !== 'rejected') {
      throw new Error(`subprocess/gate status inconsistency for ${record.path}`);
    }
  }
  if (record.parse.status !== 'passed' && record.emit.status !== 'not_run') throw new Error(`parse/emit status inconsistency for ${record.path}`);
  if (record.emit.status !== 'passed' && record.syntax.status !== 'not_run') throw new Error(`emit/syntax status inconsistency for ${record.path}`);
  if (record.syntax.status !== 'passed' && record.type.status !== 'not_run') throw new Error(`syntax/type status inconsistency for ${record.path}`);
}

function validateGate(gate, allowedStatuses, label, logicalPath) {
  if (!gate || !allowedStatuses.includes(gate.status)) throw new Error(`invalid ${label} gate for ${logicalPath}`);
}

function validateDiagnosticGate(gate, label, logicalPath) {
  validateGate(gate, ['failed', 'not_run', 'passed'], label, logicalPath);
  if (!Array.isArray(gate.diagnostics)) throw new Error(`invalid ${label} diagnostics for ${logicalPath}`);
  if (gate.status === 'not_run') {
    if (gate.diagnostics.length) throw new Error(`${label} not_run has diagnostics for ${logicalPath}`);
    return;
  }
  if (!Number.isInteger(gate.diagnosticCount) || gate.diagnosticCount < gate.diagnostics.length || typeof gate.diagnosticsTruncated !== 'boolean') {
    throw new Error(`invalid ${label} diagnostic metadata for ${logicalPath}`);
  }
  if ((gate.status === 'passed') !== (gate.diagnosticCount === 0)) throw new Error(`${label} status/count inconsistency for ${logicalPath}`);
}

function validateExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort(compareUtf8);
  const expected = expectedKeys.slice().sort(compareUtf8);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} has unexpected schema keys`);
}

function appendCanonicalLine(checkpointPath, lines, value) {
  const line = stringify(value);
  const descriptor = fs.openSync(checkpointPath, 'a');
  try {
    fs.writeSync(descriptor, `${line}\n`, null, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  lines.push(line);
}

function countResults(records) {
  const counts = {};
  records.filter(record => record.kind === 'file').forEach(record => {
    const key = `${record.subprocess.status}/${record.admission.status}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function summaryFromSeal(checkpointPath, seal) {
  return {
    checkpoint: checkpointPath,
    checkpointContentSha256: seal.checkpointContentSha256,
    classification: 'unverified_scaffold',
    fileCount: seal.fileCount,
    resultCounts: seal.resultCounts,
    sealed: true
  };
}

function verifyToolIdentity(converterRoot, expectedBaseSha, harnessRoot) {
  const packageLockPath = path.join(converterRoot, 'package-lock.json');
  const packageLockSha256 = sha256Bytes(fs.readFileSync(packageLockPath));
  if (packageLockSha256 !== EXPECTED_PACKAGE_LOCK_SHA256) throw new Error('converter package-lock SHA-256 does not match pinned fa0b5151 baseline');
  const head = git(converterRoot, ['rev-parse', 'HEAD']);
  try {
    childProcess.execFileSync('git', ['-C', converterRoot, 'merge-base', '--is-ancestor', expectedBaseSha, head], { stdio: 'ignore', windowsHide: true });
  } catch (_) {
    throw new Error(`converter baseline ${expectedBaseSha} is not an ancestor of ${head}`);
  }
  const changed = git(converterRoot, ['diff', '--name-only', `${expectedBaseSha}..${head}`]).split(/\r?\n/).filter(Boolean);
  const dirty = []
    .concat(git(converterRoot, ['diff', '--name-only']).split(/\r?\n/))
    .concat(git(converterRoot, ['diff', '--cached', '--name-only']).split(/\r?\n/))
    .concat(git(converterRoot, ['ls-files', '--others', '--exclude-standard']).split(/\r?\n/))
    .filter(Boolean);
  const forbidden = Array.from(new Set(changed.concat(dirty)))
    .filter(name => !name.startsWith('tools/hardened-corpus/') && !name.startsWith('tests/hardened-corpus/'));
  if (forbidden.length) throw new Error(`converter implementation changed after pinned baseline: ${forbidden.sort(compareUtf8).join(', ')}`);
  const packageJson = JSON.parse(fs.readFileSync(path.join(converterRoot, 'package.json'), 'utf8'));
  const typescriptPath = path.join(converterRoot, 'node_modules/typescript/package.json');
  if (!fs.existsSync(typescriptPath)) throw new Error('converter dependencies are absent; run npm ci in --converter-root or point AS3_TO_TS_CONVERTER_ROOT at an authenticated installation');
  const typescriptJson = JSON.parse(fs.readFileSync(typescriptPath, 'utf8'));
  return {
    converterBaseGitSha: expectedBaseSha,
    converterGitSha: head,
    harnessGitSha: git(harnessRoot, ['rev-parse', 'HEAD']),
    nodeVersion: process.version,
    packageLockSha256,
    packageVersion: packageJson.version,
    typescriptVersion: typescriptJson.version
  };
}

function git(root, args) {
  return childProcess.execFileSync('git', ['-C', root].concat(args), { encoding: 'utf8', windowsHide: true }).trim();
}

function minimalEnvironment(environment) {
  const result = {};
  ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'ComSpec'].forEach(name => {
    if (environment[name] !== undefined) result[name] = environment[name];
  });
  result.NODE_NO_WARNINGS = '1';
  return result;
}

function parseArguments(argv, environment) {
  const result = {
    bleachRoot: environment.BLEACH_REPO_ROOT || null,
    converterRoot: environment.AS3_TO_TS_CONVERTER_ROOT || null,
    censusPath: DEFAULT_CENSUS,
    graphPath: DEFAULT_GRAPH,
    maxOutputBytes: 1024 * 1024,
    timeoutMs: 8000
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') { result.help = true; continue; }
    const next = argv[++index];
    if (next === undefined) throw new Error(`missing value for ${argument}`);
    if (argument === '--bleach-root') result.bleachRoot = next;
    else if (argument === '--converter-root') result.converterRoot = next;
    else if (argument === '--checkpoint') result.checkpointPath = next;
    else if (argument === '--census') result.censusPath = next;
    else if (argument === '--graph') result.graphPath = next;
    else if (argument === '--max-output-bytes') result.maxOutputBytes = Number(next);
    else if (argument === '--timeout-ms') result.timeoutMs = Number(next);
    else throw new Error(`unknown argument: ${argument}`);
  }
  return result;
}

function boundedInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function assertCheckpointOutsideBleachRoot(checkpointPath, bleachRoot) {
  const relative = path.relative(bleachRoot, checkpointPath);
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('checkpoint must be outside the Bleach repository and maintained corpus');
  }
}

function helpText() {
  return [
    'usage: node tools/hardened-corpus/hardened-corpus.js --bleach-root <repo> --checkpoint <outside-repo.jsonl> [options]',
    '',
    'BLEACH_REPO_ROOT may supply --bleach-root. The exact maintained-source census is mandatory.',
    '--graph <relative-path>            dependency graph authority',
    '--census <relative-path>           SWF capability census authority',
    '--converter-root <path>            authenticated fa0b5151 checkout with dependencies',
    '--timeout-ms <1..600000>           per-file subprocess timeout (default 8000)',
    '--max-output-bytes <1..16777216>   combined child output cap (default 1048576)',
    '',
    'Generated TypeScript is never materialized or published; all legacy output is unverified_scaffold.',
    ''
  ].join('\n');
}

module.exports = {
  DEFAULT_CENSUS,
  DEFAULT_GRAPH,
  EXPECTED_CONVERTER_BASE_SHA,
  parseArguments,
  runHarness,
  runWorker
};

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { runHarness, runWorker } = require('../../tools/hardened-corpus/hardened-corpus');
const { compareUtf8, sha256Bytes, stringify } = require('../../tools/hardened-corpus/canonical');
const {
  EXPECTED_BLEACH_CENSUS,
  EXPECTED_DEPENDENCY_GRAPH_SHA256,
  authenticateDependencyGraph,
  loadAuthority
} = require('../../tools/hardened-corpus/manifest');

const repoRoot = path.resolve(__dirname, '..', '..');
const converterRoot = process.env.AS3_TO_TS_CONVERTER_ROOT || 'D:\\bleach-port-worktrees-tools\\as3-to-ts-evaluation';
const fixtureRoot = path.join(__dirname, 'fixtures');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hardened-corpus-test-'));

run().then(() => {
  process.stdout.write('hardened-corpus tests: PASS\n');
}).catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(tempRoot, { force: true, recursive: true });
});

async function run() {
  assert.strictEqual(stringify({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');

  const first = createFixtureRepository(path.join(tempRoot, 'first'), false);
  const second = createFixtureRepository(path.join(tempRoot, 'second'), true);
  const firstCheckpoint = path.join(tempRoot, 'first-checkpoint.jsonl');
  const secondCheckpoint = path.join(tempRoot, 'second-checkpoint.jsonl');
  const options = {
    converterRoot,
    harnessRoot: repoRoot,
    maxOutputBytes: 1024 * 1024,
    timeoutMs: 3000
  };
  const firstSummary = await runHarness(Object.assign({}, options, {
    bleachRoot: first.root,
    checkpointPath: firstCheckpoint,
    expectedCensus: first.expectedCensus,
    expectedDependencyGraphSha256: first.expectedDependencyGraphSha256
  }));
  const secondSummary = await withWorkingDirectory(second.root, () => runHarness(Object.assign({}, options, {
    bleachRoot: '.',
    checkpointPath: secondCheckpoint,
    expectedCensus: second.expectedCensus,
    expectedDependencyGraphSha256: second.expectedDependencyGraphSha256
  })));
  assert.strictEqual(firstSummary.sealed, true);
  assert.strictEqual(secondSummary.sealed, true);
  const firstBytes = fs.readFileSync(firstCheckpoint);
  const secondBytes = fs.readFileSync(secondCheckpoint);
  assert.deepStrictEqual(firstBytes, secondBytes, 'checkpoint must be independent of CWD and authority node order');

  const records = readCheckpoint(firstCheckpoint);
  assert.strictEqual(records[0].policy.dependencyGraphSha256, first.expectedDependencyGraphSha256, 'checkpoint policy must pin the complete graph digest');
  assert.strictEqual(records[0].authority.dependencyGraphPolicySha256, first.expectedDependencyGraphSha256, 'checkpoint header must pin the complete graph digest');
  const files = records.filter(record => record.kind === 'file');
  assert.strictEqual(files.length, first.expectedCensus.fileCount);
  const paths = files.map(record => record.path);
  assert.deepStrictEqual(paths, paths.slice().sort(compareUtf8), 'file records must be canonical UTF-8 path order');
  files.forEach(record => {
    assert.strictEqual(record.classification, 'unverified_scaffold');
    assert.strictEqual(record.output.materialized, false);
    assert.strictEqual(record.output.published, false);
  });
  assertReason(files, '01-constructor-super-order.as', 'upstream_constructor_super_order');
  assertReason(files, '02-extends-comment-hang.as', 'upstream_extends_comment_hang');
  assertReason(files, '03-break-without-semicolon-hang.as', 'upstream_break_without_semicolon_hang');
  assertReason(files, '04-missing-access-modifier.as', 'upstream_missing_access_modifier');
  assertReason(files, '05-inline-multiline-comment.as', 'upstream_inline_multiline_comment');
  assertReason(files, '06-keyword-namespace.as', 'upstream_keyword_namespace');
  assertReason(files, '07-multiple-property-definition.as', 'upstream_multiple_property_definition');
  assertReason(files, '01-e4x-descendant.as', 'semantic_e4x_navigation');
  assertReason(files, '02-namespace-selector.as', 'semantic_namespace_identity');
  assertReason(files, '03-uppercase-member-call.as', 'emission_uppercase_call_as_assertion');
  assertReason(files, '04-label-control-flow.as', 'semantic_label_control_flow');
  assertReason(files, '05-multiple-types.as', 'semantic_multiple_types_per_file');
  assertReason(files, '06-super-without-extends.as', 'semantic_super_without_extends');
  assertReason(files, '07-conditional-compilation.as', 'semantic_conditional_compilation');

  const beforeResume = fs.readFileSync(firstCheckpoint);
  const resumeSummary = await runHarness(Object.assign({}, options, {
    bleachRoot: first.root,
    checkpointPath: firstCheckpoint,
    expectedCensus: first.expectedCensus,
    expectedDependencyGraphSha256: first.expectedDependencyGraphSha256
  }));
  assert.strictEqual(resumeSummary.sealed, true);
  assert.deepStrictEqual(fs.readFileSync(firstCheckpoint), beforeResume, 'sealed resume must not rewrite checkpoint');

  const tampered = path.join(tempRoot, 'tampered.jsonl');
  fs.copyFileSync(firstCheckpoint, tampered);
  const tamperedText = fs.readFileSync(tampered, 'utf8').replace('unverified_scaffold', 'tampered_scaffold');
  fs.writeFileSync(tampered, tamperedText);
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: first.root,
    checkpointPath: tampered,
    expectedCensus: first.expectedCensus,
    expectedDependencyGraphSha256: first.expectedDependencyGraphSha256
  })), /header|canonical|hash chain|content hash/);

  const forgedCounts = path.join(tempRoot, 'forged-counts.jsonl');
  const forgedCountRecords = readCheckpoint(firstCheckpoint);
  forgedCountRecords[forgedCountRecords.length - 1].resultCounts = { forged: files.length };
  writeCanonicalRecords(forgedCounts, forgedCountRecords);
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: first.root,
    checkpointPath: forgedCounts,
    expectedCensus: first.expectedCensus,
    expectedDependencyGraphSha256: first.expectedDependencyGraphSha256
  })), /resultCounts/);

  const forgedAuthority = path.join(tempRoot, 'forged-authority.jsonl');
  const forgedAuthorityRecords = readCheckpoint(firstCheckpoint);
  forgedAuthorityRecords[1].authority.authorityNodes[0].qname = 'forged.QName';
  resealRecords(forgedAuthorityRecords);
  writeCanonicalRecords(forgedAuthority, forgedAuthorityRecords);
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: first.root,
    checkpointPath: forgedAuthority,
    expectedCensus: first.expectedCensus,
    expectedDependencyGraphSha256: first.expectedDependencyGraphSha256
  })), /full authority mismatch/);

  const forgedSchema = path.join(tempRoot, 'forged-schema.jsonl');
  const forgedSchemaRecords = readCheckpoint(firstCheckpoint);
  delete forgedSchemaRecords[1].schema;
  resealRecords(forgedSchemaRecords);
  writeCanonicalRecords(forgedSchema, forgedSchemaRecords);
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: first.root,
    checkpointPath: forgedSchema,
    expectedCensus: first.expectedCensus,
    expectedDependencyGraphSha256: first.expectedDependencyGraphSha256
  })), /schema keys/);

  const extra = path.join(first.root, 'game-client', 'tmain', 'src', 'Unmanifested.as');
  fs.writeFileSync(extra, 'package { public class Unmanifested {} }\n');
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: first.root,
    checkpointPath: path.join(tempRoot, 'extra.jsonl'),
    expectedCensus: first.expectedCensus,
    expectedDependencyGraphSha256: first.expectedDependencyGraphSha256
  })), /manifest\/disk/);
  fs.unlinkSync(extra);

  const mutated = createFixtureRepository(path.join(tempRoot, 'mutated'), false);
  await assertRejects(() => runHarness(Object.assign({}, options, {
    afterAuthorityLoaded: authority => {
      fs.appendFileSync(authority.entries[0].absolutePath, '// mutated after authority capture\n');
    },
    bleachRoot: mutated.root,
    checkpointPath: path.join(tempRoot, 'mutated.jsonl'),
    expectedCensus: mutated.expectedCensus,
    expectedDependencyGraphSha256: mutated.expectedDependencyGraphSha256
  })), /source bytes changed after authority capture/);

  const brokenEdge = createFixtureRepository(path.join(tempRoot, 'broken-edge'), false);
  mutateGraph(brokenEdge.root, graph => { graph.edges.shift(); });
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: brokenEdge.root,
    checkpointPath: path.join(tempRoot, 'broken-edge.jsonl'),
    expectedCensus: brokenEdge.expectedCensus,
    expectedDependencyGraphSha256: brokenEdge.expectedDependencyGraphSha256
  })), /prerequisites disagree|dependent_count|edge_count mismatch/);

  const brokenScc = createFixtureRepository(path.join(tempRoot, 'broken-scc'), false);
  mutateGraph(brokenScc.root, graph => { graph.sccs.shift(); graph.summary.component_count--; });
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: brokenScc.root,
    checkpointPath: path.join(tempRoot, 'broken-scc.jsonl'),
    expectedCensus: brokenScc.expectedCensus,
    expectedDependencyGraphSha256: brokenScc.expectedDependencyGraphSha256
  })), /absent from SCC membership|unknown component|SCC/);

  const changedEdge = createFixtureRepository(path.join(tempRoot, 'changed-edge'), false);
  const originalAuthority = loadFixtureAuthority(first);
  mutateGraph(changedEdge.root, graph => { graph.edges[0].evidence_line = 999; });
  const changedGraphSha256 = authenticateDependencyGraph(readFixtureGraph(changedEdge.root)).sha256;
  const changedAuthority = loadFixtureAuthority(changedEdge, changedGraphSha256);
  assert.notStrictEqual(changedAuthority.dependencyGraphSha256, originalAuthority.dependencyGraphSha256, 'semantic edge change must change graph hash');
  assert.throws(() => loadFixtureAuthority(changedEdge, originalAuthority.dependencyGraphSha256), /policy SHA-256 mismatch/);

  verifyRealDependencyGraphAdversaries();
  await verifyRealAuthorityRunAndResume(options);

  const excluded = createFixtureRepository(path.join(tempRoot, 'excluded'), false, true);
  await assertRejects(() => runHarness(Object.assign({}, options, {
    bleachRoot: excluded.root,
    checkpointPath: path.join(tempRoot, 'excluded.jsonl'),
    expectedCensus: excluded.expectedCensus,
    expectedDependencyGraphSha256: excluded.expectedDependencyGraphSha256
  })), /excluded SWC shell mirror/);

  const samplePath = files.find(record => record.path.endsWith('03-uppercase-member-call.as')).path;
  const sampleAbsolute = path.join(first.root, ...samplePath.split('/'));
  const sampleBytes = fs.readFileSync(sampleAbsolute);
  const capped = await runWorker({
    definitionsByNamespace: {},
    logicalPath: samplePath,
    sourceBase64: sampleBytes.toString('base64'),
    sourceSha256: sha256Bytes(sampleBytes),
    sourceSize: sampleBytes.length,
    toolRoot: converterRoot
  }, {
    maxOutputBytes: 1,
    timeoutMs: 3000,
    workerPath: path.join(repoRoot, 'tools', 'hardened-corpus', 'worker.js')
  });
  assert.strictEqual(capped.status, 'output_cap_exceeded');
  const timedOut = await runWorker({
    definitionsByNamespace: {},
    logicalPath: samplePath,
    sourceBase64: sampleBytes.toString('base64'),
    sourceSha256: sha256Bytes(sampleBytes),
    sourceSize: sampleBytes.length,
    toolRoot: converterRoot
  }, {
    maxOutputBytes: 1024 * 1024,
    timeoutMs: 1,
    workerPath: path.join(repoRoot, 'tools', 'hardened-corpus', 'worker.js')
  });
  assert.strictEqual(timedOut.status, 'timeout');
  const badIdentity = await runWorker({
    definitionsByNamespace: {},
    logicalPath: samplePath,
    sourceBase64: sampleBytes.toString('base64'),
    sourceSha256: '0'.repeat(64),
    sourceSize: sampleBytes.length,
    toolRoot: converterRoot
  }, {
    maxOutputBytes: 1024 * 1024,
    timeoutMs: 3000,
    workerPath: path.join(repoRoot, 'tools', 'hardened-corpus', 'worker.js')
  });
  assert.strictEqual(badIdentity.status, 'worker_failed');

  assert.strictEqual(findFiles(tempRoot, '.ts').length, 0, 'harness must never materialize generated TypeScript');
}

function createFixtureRepository(root, reverseNodes, includeExcluded) {
  const applicationRoot = path.join(root, 'game-client', 'tapplication_main', 'src');
  const bootstrapRoot = path.join(root, 'game-client', 'tmain', 'src');
  fs.mkdirSync(applicationRoot, { recursive: true });
  fs.mkdirSync(bootstrapRoot, { recursive: true });
  const fixtures = findFiles(fixtureRoot, '.as').sort(compareUtf8);
  const nodes = [];
  fixtures.forEach((sourcePath, index) => {
    const relativeFixture = path.relative(fixtureRoot, sourcePath);
    const destination = path.join(applicationRoot, 'fixtures', relativeFixture);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(sourcePath, destination);
    const logical = toLogical(path.relative(root, destination));
    nodes.push({
      component_id: `scc-${String(index).padStart(3, '0')}`,
      dependent_count: index < fixtures.length - 1 ? 1 : 0,
      function_count: 0,
      module: 'application',
      node_id: `fixture-${String(index).padStart(3, '0')}`,
      node_kind: 'as3_type',
      prerequisites: index === 0 ? [] : [`fixture-${String(index - 1).padStart(3, '0')}`],
      qname: `fixtures.Fixture${index}`,
      source_path: logical,
      source_sha256: sha256Bytes(fs.readFileSync(destination)),
      topological_level: index,
      type_kind: 'class'
    });
  });
  if (includeExcluded) {
    nodes.push({
      component_id: 'scc-excluded',
      dependent_count: 0,
      function_count: 0,
      module: 'excluded-shell',
      node_id: 'excluded-shell',
      node_kind: 'as3_type',
      prerequisites: [],
      qname: 'excluded.Shell',
      source_path: 'game-client/swc/tapplication/src/Excluded.as',
      source_sha256: '0'.repeat(64),
      topological_level: 0,
      type_kind: 'class'
    });
  }
  const graphNodes = reverseNodes ? nodes.slice().reverse() : nodes;
  const edges = nodes.slice(1, fixtures.length).map((node, index) => ({
    consumer: node.node_id,
    evidence_line: index + 1,
    evidence_occurrence_count: 1,
    evidence_path: node.source_path,
    evidence_symbol: nodes[index].qname,
    kind: 'explicit_import',
    prerequisite: nodes[index].node_id
  }));
  const sccs = nodes.map((node, index) => ({
    component_id: node.component_id,
    cyclic: false,
    dependent_components: index < fixtures.length - 1 ? [nodes[index + 1].component_id] : [],
    members: [node.node_id],
    prerequisite_components: index > 0 && index < fixtures.length ? [nodes[index - 1].component_id] : [],
    topological_level: node.topological_level
  }));
  const graph = {
    edge_semantics: { direction: 'consumer-to-prerequisite' },
    edges: reverseNodes ? edges.slice().reverse() : edges,
    generator: 'hardened-corpus-fixture',
    missing_flash_adapters: [],
    nodes: graphNodes,
    sccs: reverseNodes ? sccs.slice().reverse() : sccs,
    schema_version: 1,
    source_manifest_sha256: 'fixture-source-manifest',
    summary: {
      as3_file_count: fixtures.length,
      as3_type_count: fixtures.length,
      component_count: sccs.length,
      cyclic_component_count: 0,
      edge_count: edges.length,
      edge_kind_counts: edges.length ? { explicit_import: edges.length } : {},
      executable_authored_function_count: 0,
      executable_type_count: fixtures.length,
      flash_api_count: 0,
      function_count: 0,
      missing_flash_adapter_count: 0,
      module_node_counts: includeExcluded
        ? { application: fixtures.length, 'excluded-shell': 1 }
        : { application: fixtures.length },
      node_count: nodes.length,
      raw_authored_function_count: 0,
      script_ordering_missing_predecessor_count: 0,
      unresolved_project_reference_count: 0,
      wildcard_evidence_gap_count: 0
    },
    unresolved_project_references: [],
    unresolved_script_ordering_predecessors: [],
    wildcard_evidence_gaps: []
  };
  const reportRoot = path.join(root, 'as3-to-layaair-porting-kit', 'generated');
  const graphPath = path.join(reportRoot, 'dependency-graph', 'bleach-as3-dependency-graph.json');
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  fs.writeFileSync(graphPath, JSON.stringify(graph));
  const expectedDependencyGraphSha256 = authenticateDependencyGraph(graph).sha256;
  const sourceSetSha256 = fixtureSourceSet(root, nodes.filter(node => !node.source_path.startsWith('game-client/swc/')));
  const expectedCensus = {
    fileCount: fixtures.length,
    roots: ['game-client/tapplication_main/src', 'game-client/tmain/src'],
    sourceSetSha256
  };
  const census = {
    authorities: {
      as3MaintainedSource: {
        fileCount: fixtures.length,
        hashPolicy: 'logical path plus canonical-LF source bytes',
        roots: expectedCensus.roots,
        sourceSetSha256
      }
    }
  };
  const censusPath = path.join(reportRoot, 'reports', 'swf-capability-census.json');
  fs.mkdirSync(path.dirname(censusPath), { recursive: true });
  fs.writeFileSync(censusPath, JSON.stringify(census));
  return { expectedCensus, expectedDependencyGraphSha256, root };
}

function loadFixtureAuthority(fixture, expectedDependencyGraphSha256) {
  return loadAuthority(
    fixture.root,
    'as3-to-layaair-porting-kit/generated/dependency-graph/bleach-as3-dependency-graph.json',
    'as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json',
    fixture.expectedCensus,
    expectedDependencyGraphSha256 === undefined
      ? fixture.expectedDependencyGraphSha256
      : expectedDependencyGraphSha256
  );
}

function readFixtureGraph(root) {
  const graphPath = path.join(root, 'as3-to-layaair-porting-kit', 'generated', 'dependency-graph', 'bleach-as3-dependency-graph.json');
  return JSON.parse(fs.readFileSync(graphPath, 'utf8'));
}

function verifyRealDependencyGraphAdversaries() {
  const bleachRoot = process.env.BLEACH_REPO_ROOT;
  assert(bleachRoot, 'BLEACH_REPO_ROOT is required for real dependency-graph adversary tests');
  const graphPath = path.join(bleachRoot, 'as3-to-layaair-porting-kit', 'generated', 'dependency-graph', 'bleach-as3-dependency-graph.json');
  assert(fs.existsSync(graphPath), `real dependency graph is required for adversary tests: ${graphPath}`);
  const original = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  assert.strictEqual(authenticateDependencyGraph(original).sha256, EXPECTED_DEPENDENCY_GRAPH_SHA256, 'real graph must match the pinned policy digest');

  assertGraphMutationRejected(original, graph => {
    findScc(graph, 'scc-00010').cyclic = false;
  }, /cyclic flag/);
  assertGraphMutationRejected(original, graph => {
    findScc(graph, 'scc-00010').topological_level = -999;
  }, /topological_level/);
  assertGraphMutationRejected(original, graph => {
    graph.summary.cyclic_component_count = 0;
  }, /cyclic_component_count/);
  assertGraphMutationRejected(original, graph => {
    graph.summary.edge_kind_counts.explicit_import = 0;
  }, /edge_kind_counts/);
  assertGraphMutationRejected(original, graph => {
    graph.summary.module_node_counts.application = 0;
  }, /module_node_counts/);

  const splitComponent = JSON.parse(JSON.stringify(original));
  const target = findScc(splitComponent, 'scc-00010');
  const moved = target.members.pop();
  splitComponent.nodes.find(node => node.node_id === moved).component_id = 'scc-forged-split';
  splitComponent.sccs.push({
    component_id: 'scc-forged-split',
    cyclic: false,
    dependent_components: [],
    members: [moved],
    prerequisite_components: [],
    topological_level: 0
  });
  splitComponent.summary.component_count++;
  assert.throws(() => authenticateDependencyGraph(splitComponent), /strongly connected and maximal|prerequisite_components|dependent_components/);
}

async function verifyRealAuthorityRunAndResume(options) {
  const bleachRoot = process.env.BLEACH_REPO_ROOT;
  assert(bleachRoot, 'BLEACH_REPO_ROOT is required for real authority tests');
  const authority = loadAuthority(
    bleachRoot,
    'as3-to-layaair-porting-kit/generated/dependency-graph/bleach-as3-dependency-graph.json',
    'as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json'
  );
  assert.strictEqual(authority.entries.length, EXPECTED_BLEACH_CENSUS.fileCount);
  authority.entries.forEach(entry => {
    assert.strictEqual(
      sha256Bytes(entry.sourceBytes),
      entry.sourceSha256,
      `${entry.logicalPath}: raw worker identity must authenticate exact disk bytes`
    );
  });
  const distinctEolEntry = authority.entries.find(
    entry => entry.graphSourceSha256 !== entry.sourceSha256
  );
  if (distinctEolEntry) {
    assert.notStrictEqual(
      distinctEolEntry.graphSourceSha256,
      distinctEolEntry.sourceSha256,
      'canonical graph and raw worker identities must remain independent when EOL bytes differ'
    );
  }

  const checkpointPath = path.join(tempRoot, 'real-authority.jsonl');
  const realOptions = Object.assign({}, options, {
    bleachRoot,
    checkpointPath,
    maxOutputBytes: 1024,
    timeoutMs: 1
  });
  const first = await runHarness(realOptions);
  assert.strictEqual(first.sealed, true);
  assert.strictEqual(first.fileCount, EXPECTED_BLEACH_CENSUS.fileCount);
  const sealedBytes = fs.readFileSync(checkpointPath);
  const resumed = await runHarness(realOptions);
  assert.strictEqual(resumed.sealed, true);
  assert.deepStrictEqual(
    fs.readFileSync(checkpointPath),
    sealedBytes,
    'real sealed resume must not rewrite the checkpoint'
  );
}

function assertGraphMutationRejected(original, mutate, pattern) {
  const copy = JSON.parse(JSON.stringify(original));
  mutate(copy);
  assert.throws(() => authenticateDependencyGraph(copy), pattern);
}

function findScc(graph, componentId) {
  const scc = graph.sccs.find(candidate => candidate.component_id === componentId);
  assert(scc, `missing real SCC ${componentId}`);
  return scc;
}

function mutateGraph(root, callback) {
  const graphPath = path.join(root, 'as3-to-layaair-porting-kit', 'generated', 'dependency-graph', 'bleach-as3-dependency-graph.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  callback(graph);
  fs.writeFileSync(graphPath, JSON.stringify(graph));
}

function writeCanonicalRecords(file, records) {
  fs.writeFileSync(file, `${records.map(stringify).join('\n')}\n`);
}

function resealRecords(records) {
  for (let index = 1; index < records.length; index++) {
    records[index].previousLineSha256 = sha256Bytes(Buffer.from(stringify(records[index - 1]), 'utf8'));
  }
  const seal = records[records.length - 1];
  seal.checkpointContentSha256 = sha256Bytes(Buffer.from(`${records.slice(0, -1).map(stringify).join('\n')}\n`, 'utf8'));
}

function fixtureSourceSet(root, nodes) {
  const rows = nodes.map(node => {
    const raw = fs.readFileSync(path.join(root, ...node.source_path.split('/')));
    const canonicalLf = Buffer.from(raw.toString('binary').replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'binary');
    return { path: node.source_path, sha256: sha256Bytes(canonicalLf) };
  }).sort((left, right) => left.path.toLowerCase().localeCompare(right.path.toLowerCase()) || compareUtf8(left.path, right.path));
  return sha256Bytes(Buffer.from(rows.map(row => `${row.path}\0${row.sha256}\n`).join(''), 'utf8'));
}

function readCheckpoint(file) {
  const text = fs.readFileSync(file, 'utf8');
  assert(text.endsWith('\n'));
  return text.trimEnd().split('\n').map(line => {
    const value = JSON.parse(line);
    assert.strictEqual(stringify(value), line);
    return value;
  });
}

function assertReason(files, suffix, code) {
  const record = files.find(file => file.path.endsWith(suffix));
  assert(record, `missing fixture record ${suffix}`);
  const codes = record.admission.reasons.map(reason => reason.code);
  assert(codes.includes(code), `${suffix} missing ${code}; got ${codes.join(', ')}`);
}

async function assertRejects(action, pattern) {
  let error = null;
  try { await action(); } catch (caught) { error = caught; }
  assert(error, 'expected rejection');
  assert(pattern.test(error.message), `unexpected rejection: ${error.message}`);
}

async function withWorkingDirectory(directory, action) {
  const previous = process.cwd();
  process.chdir(directory);
  try { return await action(); } finally { process.chdir(previous); }
}

function findFiles(root, extension) {
  const result = [];
  if (!fs.existsSync(root)) return result;
  fs.readdirSync(root).forEach(name => {
    const candidate = path.join(root, name);
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) result.push(...findFiles(candidate, extension));
    else if (name.endsWith(extension)) result.push(candidate);
  });
  return result;
}

function toLogical(value) {
  return value.split(path.sep).join('/');
}

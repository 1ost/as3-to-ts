'use strict';

const fs = require('fs');
const path = require('path');
const { compareUtf8, sha256Bytes, sha256Json, stringify } = require('./canonical');

const MAINTAINED_ROOTS = [
  { module: 'application', path: 'game-client/tapplication_main/src' },
  { module: 'bootstrap', path: 'game-client/tmain/src' }
];

const EXCLUDED_SHELL_ROOT = 'game-client/swc/tapplication/src';
const EXPECTED_BLEACH_CENSUS = {
  fileCount: 2921,
  roots: MAINTAINED_ROOTS.map(root => root.path),
  sourceSetSha256: '45ae512fe7ef44e01199e4aaeb95722cf5afd287da1084626e25366790c03790'
};
const EXPECTED_DEPENDENCY_GRAPH_SHA256 = '3d0d7e0717708e2931bb9cf81de913aa21f5fe4b24babb2703edd9abdcb8f593';

function loadAuthority(bleachRoot, manifestRelativePath, censusRelativePath, expectedCensus, expectedDependencyGraphSha256) {
  const root = fs.realpathSync(path.resolve(bleachRoot));
  const manifestPath = resolveInside(root, manifestRelativePath);
  const censusPath = resolveInside(root, censusRelativePath);
  requireRegularFileWithoutSymlink(manifestPath, root);
  requireRegularFileWithoutSymlink(censusPath, root);
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const census = JSON.parse(fs.readFileSync(censusPath, 'utf8'));
  const censusAuthority = census && census.authorities && census.authorities.as3MaintainedSource;
  validateCensusAuthority(censusAuthority, expectedCensus || EXPECTED_BLEACH_CENSUS);
  if (!Array.isArray(parsed.nodes) || !parsed.summary) {
    throw new Error('authority manifest must contain nodes[] and summary');
  }

  const graphSemantics = authenticateDependencyGraph(parsed);
  const graphPolicySha256 = expectedDependencyGraphSha256 === undefined
    ? EXPECTED_DEPENDENCY_GRAPH_SHA256
    : expectedDependencyGraphSha256;
  if (typeof graphPolicySha256 !== 'string' || !/^[0-9a-f]{64}$/.test(graphPolicySha256)) {
    throw new Error('dependency graph policy SHA-256 must be an exact lowercase digest');
  }
  if (graphSemantics.sha256 !== graphPolicySha256) {
    throw new Error(`dependency graph policy SHA-256 mismatch: expected=${graphPolicySha256} actual=${graphSemantics.sha256}`);
  }
  const byPath = new Map();
  parsed.nodes.forEach(node => {
    if (typeof node.source_path === 'string' && normalizeLogicalPath(node.source_path).startsWith(`${EXCLUDED_SHELL_ROOT}/`)) {
      throw new Error(`excluded SWC shell mirror is forbidden: ${node.source_path}`);
    }
    if (node.module !== 'application' && node.module !== 'bootstrap') return;
    if (typeof node.source_path !== 'string' || !node.source_path.endsWith('.as')) return;
    const logicalPath = normalizeLogicalPath(node.source_path);
    assertMaintainedPath(logicalPath, node.module);
    const sourceSha256 = requireSha256(node.source_sha256, logicalPath);
    const existing = byPath.get(logicalPath) || {
      logicalPath,
      module: node.module,
      sourceSha256,
      authorityNodes: []
    };
    if (existing.module !== node.module || existing.sourceSha256 !== sourceSha256) {
      throw new Error(`conflicting authority entries for ${logicalPath}`);
    }
    existing.authorityNodes.push(normalizeAuthorityNode(node));
    byPath.set(logicalPath, existing);
  });

  const entries = Array.from(byPath.values()).sort((left, right) => compareUtf8(left.logicalPath, right.logicalPath));
  const declaredCount = Number(parsed.summary.as3_file_count);
  if (!Number.isInteger(declaredCount) || declaredCount !== entries.length) {
    throw new Error(`authority as3_file_count ${declaredCount} does not equal selected path count ${entries.length}`);
  }

  const diskPaths = enumerateMaintainedSources(root);
  const manifestPaths = entries.map(entry => entry.logicalPath);
  assertExactSet(manifestPaths, diskPaths);

  entries.forEach(entry => {
    const absolutePath = resolveInside(root, entry.logicalPath);
    requireRegularFileWithoutSymlink(absolutePath, root);
    const bytes = fs.readFileSync(absolutePath);
    const digest = sha256Bytes(bytes);
    if (digest !== entry.sourceSha256) {
      throw new Error(`source SHA-256 mismatch for ${entry.logicalPath}: authority=${entry.sourceSha256} actual=${digest}`);
    }
    entry.sourceSize = bytes.length;
    entry.sourceBytes = bytes;
    entry.absolutePath = absolutePath;
    entry.authorityNodes.sort((left, right) => compareUtf8(left.nodeId, right.nodeId));
  });

  const computedSourceSetSha256 = computeCanonicalLfSourceSet(entries);
  if (computedSourceSetSha256 !== censusAuthority.sourceSetSha256) {
    throw new Error(`canonical-LF source set mismatch: census=${censusAuthority.sourceSetSha256} actual=${computedSourceSetSha256}`);
  }

  const semanticManifest = {
    dependencyGraphSha256: graphSemantics.sha256,
    dependencyGraphPolicySha256: graphPolicySha256,
    dependencyGraphSummary: graphSemantics.summary,
    schemaVersion: parsed.schema_version === undefined ? null : parsed.schema_version,
    sourceManifestSha256: parsed.source_manifest_sha256 || null,
    summary: {
      as3FileCount: declaredCount,
      as3TypeCount: Number(parsed.summary.as3_type_count)
    },
    files: entries.map(publicEntry)
  };

  return {
    bleachRoot: root,
    definitionsByModule: buildDefinitions(entries),
    entries,
    manifestSha256: sha256Json(semanticManifest),
    censusAuthority: {
      fileCount: censusAuthority.fileCount,
      hashPolicy: censusAuthority.hashPolicy,
      roots: censusAuthority.roots,
      sourceSetSha256: censusAuthority.sourceSetSha256
    },
    censusSha256: sha256Json(censusAuthority),
    dependencyGraphSha256: graphSemantics.sha256,
    dependencyGraphPolicySha256: graphPolicySha256,
    dependencyGraphSummary: graphSemantics.summary,
    semanticManifest,
    sourceManifestSha256: parsed.source_manifest_sha256 || null
  };
}

function authenticateDependencyGraph(graph) {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.sccs)) {
    throw new Error('dependency graph must contain nodes[], edges[], and sccs[]');
  }
  const nodes = graph.nodes.map(node => {
    const copy = JSON.parse(JSON.stringify(node));
    if (!Array.isArray(copy.prerequisites)) throw new Error(`dependency node ${copy.node_id} lacks prerequisites[]`);
    copy.prerequisites = sortedUniqueStrings(copy.prerequisites, `node ${copy.node_id} prerequisites`);
    return copy;
  }).sort((left, right) => compareUtf8(left.node_id, right.node_id));
  const nodeById = new Map();
  nodes.forEach(node => {
    if (typeof node.node_id !== 'string' || !node.node_id || nodeById.has(node.node_id)) {
      throw new Error(`invalid or duplicate dependency node_id: ${node.node_id}`);
    }
    nodeById.set(node.node_id, node);
  });

  const edges = graph.edges.map(edge => JSON.parse(JSON.stringify(edge))).sort(compareCanonicalValues);
  const prerequisitesByConsumer = new Map();
  const dependentsByPrerequisite = new Map();
  edges.forEach((edge, index) => {
    if (!nodeById.has(edge.consumer) || !nodeById.has(edge.prerequisite)) {
      throw new Error(`dependency edge ${index} has an unknown endpoint`);
    }
    if (!prerequisitesByConsumer.has(edge.consumer)) prerequisitesByConsumer.set(edge.consumer, new Set());
    prerequisitesByConsumer.get(edge.consumer).add(edge.prerequisite);
    if (!dependentsByPrerequisite.has(edge.prerequisite)) dependentsByPrerequisite.set(edge.prerequisite, new Set());
    dependentsByPrerequisite.get(edge.prerequisite).add(edge.consumer);
  });
  nodes.forEach(node => {
    const derived = Array.from(prerequisitesByConsumer.get(node.node_id) || []).sort(compareUtf8);
    if (JSON.stringify(derived) !== JSON.stringify(node.prerequisites)) {
      throw new Error(`dependency prerequisites disagree with edges for ${node.node_id}`);
    }
    const derivedDependentCount = (dependentsByPrerequisite.get(node.node_id) || new Set()).size;
    if (node.dependent_count !== derivedDependentCount) {
      throw new Error(`dependency dependent_count disagrees with edges for ${node.node_id}`);
    }
  });

  const sccs = graph.sccs.map(scc => {
    const copy = JSON.parse(JSON.stringify(scc));
    copy.members = sortedUniqueStrings(copy.members, `SCC ${copy.component_id} members`);
    copy.prerequisite_components = sortedUniqueStrings(copy.prerequisite_components, `SCC ${copy.component_id} prerequisites`);
    copy.dependent_components = sortedUniqueStrings(copy.dependent_components, `SCC ${copy.component_id} dependents`);
    return copy;
  }).sort((left, right) => compareUtf8(left.component_id, right.component_id));
  const sccById = new Map();
  sccs.forEach(scc => {
    if (typeof scc.component_id !== 'string' || !scc.component_id || sccById.has(scc.component_id)) {
      throw new Error(`invalid or duplicate component_id: ${scc.component_id}`);
    }
    sccById.set(scc.component_id, scc);
  });
  const memberOwner = new Map();
  sccs.forEach(scc => scc.members.forEach(nodeId => {
    const node = nodeById.get(nodeId);
    if (!node) throw new Error(`SCC ${scc.component_id} contains unknown node ${nodeId}`);
    if (memberOwner.has(nodeId)) throw new Error(`dependency node ${nodeId} belongs to multiple SCCs`);
    if (node.component_id !== scc.component_id) throw new Error(`dependency node ${nodeId} component_id disagrees with SCC membership`);
    memberOwner.set(nodeId, scc.component_id);
  }));
  nodes.forEach(node => {
    if (!memberOwner.has(node.node_id)) throw new Error(`dependency node ${node.node_id} is absent from SCC membership`);
  });

  const recomputedComponents = computeStronglyConnectedComponents(nodes);
  const declaredComponentByMembers = new Map();
  sccs.forEach(scc => declaredComponentByMembers.set(stringify(scc.members), scc));
  recomputedComponents.forEach(members => {
    if (!declaredComponentByMembers.has(stringify(members))) {
      throw new Error(`declared SCC partition is not strongly connected and maximal at ${members[0]}`);
    }
  });
  if (recomputedComponents.length !== sccs.length) {
    throw new Error(`declared SCC count disagrees with recomputed maximal partition`);
  }

  const selfLoops = new Set(edges.filter(edge => edge.consumer === edge.prerequisite).map(edge => edge.consumer));
  sccs.forEach(scc => {
    const expectedCyclic = scc.members.length > 1 || selfLoops.has(scc.members[0]);
    if (scc.cyclic !== expectedCyclic) {
      throw new Error(`SCC cyclic flag disagrees with graph for ${scc.component_id}`);
    }
    if (!Number.isInteger(scc.topological_level) || scc.topological_level < 0) {
      throw new Error(`SCC topological_level is invalid for ${scc.component_id}`);
    }
  });

  const prerequisiteComponents = new Map();
  const dependentComponents = new Map();
  sccs.forEach(scc => {
    prerequisiteComponents.set(scc.component_id, new Set());
    dependentComponents.set(scc.component_id, new Set());
  });
  edges.forEach(edge => {
    const consumerComponent = nodeById.get(edge.consumer).component_id;
    const prerequisiteComponent = nodeById.get(edge.prerequisite).component_id;
    if (consumerComponent !== prerequisiteComponent) {
      prerequisiteComponents.get(consumerComponent).add(prerequisiteComponent);
      dependentComponents.get(prerequisiteComponent).add(consumerComponent);
    }
  });
  sccs.forEach(scc => {
    const expectedPrerequisites = Array.from(prerequisiteComponents.get(scc.component_id)).sort(compareUtf8);
    const expectedDependents = Array.from(dependentComponents.get(scc.component_id)).sort(compareUtf8);
    if (JSON.stringify(expectedPrerequisites) !== JSON.stringify(scc.prerequisite_components)) {
      throw new Error(`SCC prerequisite_components disagree with edges for ${scc.component_id}`);
    }
    if (JSON.stringify(expectedDependents) !== JSON.stringify(scc.dependent_components)) {
      throw new Error(`SCC dependent_components disagree with edges for ${scc.component_id}`);
    }
  });
  const recomputedLevels = computeCondensationLevels(sccs, prerequisiteComponents, dependentComponents);
  sccs.forEach(scc => {
    if (scc.topological_level !== recomputedLevels.get(scc.component_id)) {
      throw new Error(`SCC topological_level disagrees with condensation DAG for ${scc.component_id}`);
    }
  });
  nodes.forEach(node => {
    const componentLevel = recomputedLevels.get(node.component_id);
    if (node.topological_level !== componentLevel) {
      throw new Error(`dependency node topological_level disagrees with SCC for ${node.node_id}`);
    }
  });

  const unresolved = {
    missingFlashAdapters: sortedCanonicalArray(graph.missing_flash_adapters, 'missing_flash_adapters'),
    unresolvedProjectReferences: sortedCanonicalArray(graph.unresolved_project_references, 'unresolved_project_references'),
    unresolvedScriptOrderingPredecessors: sortedCanonicalArray(graph.unresolved_script_ordering_predecessors, 'unresolved_script_ordering_predecessors'),
    wildcardEvidenceGaps: sortedCanonicalArray(graph.wildcard_evidence_gaps, 'wildcard_evidence_gaps')
  };
  const maintainedNodeCount = nodes.filter(node => node.module === 'application' || node.module === 'bootstrap').length;
  const maintainedNodes = nodes.filter(node => node.module === 'application' || node.module === 'bootstrap');
  const maintainedFileCount = new Set(maintainedNodes.map(node => node.source_path)).size;
  const maintainedFunctionCount = maintainedNodes.reduce((total, node) => {
    if (!Number.isInteger(node.function_count) || node.function_count < 0) {
      throw new Error(`dependency node function_count is invalid for ${node.node_id}`);
    }
    return total + node.function_count;
  }, 0);
  const edgeKindCounts = countBy(edges, edge => edge.kind, 'edge kind');
  const moduleNodeCounts = countBy(nodes, node => node.module, 'node module');
  validateGraphSummary(graph.summary, {
    as3FileCount: maintainedFileCount,
    componentCount: sccs.length,
    cyclicComponentCount: sccs.filter(scc => scc.cyclic).length,
    edgeCount: edges.length,
    edgeKindCounts,
    flashApiCount: nodes.filter(node => node.node_kind === 'flash_api').length,
    functionCount: maintainedFunctionCount,
    maintainedNodeCount,
    missingFlashAdapterCount: unresolved.missingFlashAdapters.length,
    nodeCount: nodes.length,
    moduleNodeCounts,
    unresolvedProjectReferenceCount: unresolved.unresolvedProjectReferences.length,
    unresolvedScriptOrderingPredecessorCount: unresolved.unresolvedScriptOrderingPredecessors.length,
    wildcardEvidenceGapCount: unresolved.wildcardEvidenceGaps.length
  });
  const semanticGraph = {
    edgeSemantics: graph.edge_semantics || null,
    edges,
    generator: graph.generator || null,
    nodes,
    sccs,
    schemaVersion: graph.schema_version,
    sourceManifestSha256: graph.source_manifest_sha256 || null,
    summary: graph.summary,
    unresolved
  };
  return {
    semanticGraph,
    sha256: sha256Json(semanticGraph),
    summary: {
      edgeCount: edges.length,
      maintainedNodeCount,
      nodeCount: nodes.length,
      sccCount: sccs.length,
      unresolvedCounts: {
        missingFlashAdapters: unresolved.missingFlashAdapters.length,
        unresolvedProjectReferences: unresolved.unresolvedProjectReferences.length,
        unresolvedScriptOrderingPredecessors: unresolved.unresolvedScriptOrderingPredecessors.length,
        wildcardEvidenceGaps: unresolved.wildcardEvidenceGaps.length
      }
    }
  };
}

function validateGraphSummary(summary, actual) {
  if (!summary || typeof summary !== 'object') throw new Error('dependency graph summary is required');
  const checks = [
    ['as3_file_count', actual.as3FileCount],
    ['node_count', actual.nodeCount],
    ['as3_type_count', actual.maintainedNodeCount],
    ['edge_count', actual.edgeCount],
    ['component_count', actual.componentCount],
    ['cyclic_component_count', actual.cyclicComponentCount],
    ['flash_api_count', actual.flashApiCount],
    ['function_count', actual.functionCount],
    ['raw_authored_function_count', actual.functionCount],
    ['executable_authored_function_count', actual.functionCount],
    ['executable_type_count', actual.maintainedNodeCount],
    ['missing_flash_adapter_count', actual.missingFlashAdapterCount],
    ['unresolved_project_reference_count', actual.unresolvedProjectReferenceCount],
    ['script_ordering_missing_predecessor_count', actual.unresolvedScriptOrderingPredecessorCount],
    ['wildcard_evidence_gap_count', actual.wildcardEvidenceGapCount]
  ];
  checks.forEach(([key, value]) => {
    if (summary[key] !== value) throw new Error(`dependency graph summary ${key} mismatch: summary=${summary[key]} actual=${value}`);
  });
  assertExactCountMap(summary.edge_kind_counts, actual.edgeKindCounts, 'edge_kind_counts');
  assertExactCountMap(summary.module_node_counts, actual.moduleNodeCounts, 'module_node_counts');
}

function computeStronglyConnectedComponents(nodes) {
  const adjacency = new Map(nodes.map(node => [node.node_id, node.prerequisites]));
  const indices = new Map();
  const lowLinks = new Map();
  const onStack = new Set();
  const stack = [];
  const components = [];
  let nextIndex = 0;

  function visit(nodeId) {
    indices.set(nodeId, nextIndex);
    lowLinks.set(nodeId, nextIndex);
    nextIndex++;
    stack.push(nodeId);
    onStack.add(nodeId);
    adjacency.get(nodeId).forEach(prerequisite => {
      if (!indices.has(prerequisite)) {
        visit(prerequisite);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), lowLinks.get(prerequisite)));
      } else if (onStack.has(prerequisite)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), indices.get(prerequisite)));
      }
    });
    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;
    const members = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      members.push(member);
    } while (member !== nodeId);
    components.push(members.sort(compareUtf8));
  }

  nodes.forEach(node => {
    if (!indices.has(node.node_id)) visit(node.node_id);
  });
  return components.sort((left, right) => compareUtf8(stringify(left), stringify(right)));
}

function computeCondensationLevels(sccs, prerequisites, dependents) {
  const remainingPrerequisites = new Map();
  const levels = new Map();
  const queue = [];
  sccs.forEach(scc => {
    const count = prerequisites.get(scc.component_id).size;
    remainingPrerequisites.set(scc.component_id, count);
    if (count === 0) {
      levels.set(scc.component_id, 0);
      queue.push(scc.component_id);
    }
  });
  queue.sort(compareUtf8);
  let processed = 0;
  while (queue.length) {
    const componentId = queue.shift();
    processed++;
    Array.from(dependents.get(componentId)).sort(compareUtf8).forEach(dependentId => {
      levels.set(dependentId, Math.max(levels.get(dependentId) || 0, levels.get(componentId) + 1));
      const remaining = remainingPrerequisites.get(dependentId) - 1;
      remainingPrerequisites.set(dependentId, remaining);
      if (remaining === 0) {
        queue.push(dependentId);
        queue.sort(compareUtf8);
      }
    });
  }
  if (processed !== sccs.length) throw new Error('dependency condensation graph contains a cycle');
  return levels;
}

function countBy(values, keySelector, label) {
  const counts = {};
  values.forEach(value => {
    const key = keySelector(value);
    if (typeof key !== 'string' || !key) throw new Error(`invalid ${label}`);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function assertExactCountMap(declared, actual, label) {
  if (!declared || typeof declared !== 'object' || Array.isArray(declared) || stringify(declared) !== stringify(actual)) {
    throw new Error(`dependency graph summary ${label} mismatch: summary=${stringify(declared)} actual=${stringify(actual)}`);
  }
}

function sortedUniqueStrings(values, label) {
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error(`${label} must be a string array`);
  const sorted = values.slice().sort(compareUtf8);
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index] === sorted[index - 1]) throw new Error(`${label} contains duplicate ${sorted[index]}`);
  }
  return sorted;
}

function sortedCanonicalArray(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  return values.map(value => JSON.parse(JSON.stringify(value))).sort(compareCanonicalValues);
}

function compareCanonicalValues(left, right) {
  return compareUtf8(stringify(left), stringify(right));
}

function validateCensusAuthority(authority, expected) {
  if (!authority || typeof authority !== 'object') throw new Error('missing authorities.as3MaintainedSource');
  if (authority.hashPolicy !== 'logical path plus canonical-LF source bytes') {
    throw new Error(`unexpected maintained-source hash policy: ${authority.hashPolicy}`);
  }
  if (authority.fileCount !== expected.fileCount) {
    throw new Error(`maintained-source fileCount mismatch: expected=${expected.fileCount} actual=${authority.fileCount}`);
  }
  if (JSON.stringify(authority.roots) !== JSON.stringify(expected.roots)) {
    throw new Error(`maintained-source roots mismatch: expected=${JSON.stringify(expected.roots)} actual=${JSON.stringify(authority.roots)}`);
  }
  if (authority.roots.includes(EXCLUDED_SHELL_ROOT)) {
    throw new Error('excluded SWC shell mirror cannot be a maintained source root');
  }
  if (authority.sourceSetSha256 !== expected.sourceSetSha256) {
    throw new Error(`maintained-source sourceSetSha256 mismatch: expected=${expected.sourceSetSha256} actual=${authority.sourceSetSha256}`);
  }
}

function computeCanonicalLfSourceSet(entries) {
  const rows = entries.map(entry => {
    const raw = entry.sourceBytes;
    const canonicalLf = Buffer.from(raw.toString('binary').replace(/\r\n/g, '\n').replace(/\r/g, '\n'), 'binary');
    return {
      canonicalLfSha256: sha256Bytes(canonicalLf),
      path: entry.logicalPath
    };
  }).sort((left, right) => {
    const folded = compareUtf8(left.path.toLowerCase(), right.path.toLowerCase());
    return folded || compareUtf8(left.path, right.path);
  });
  const basis = rows.map(row => `${row.path}\0${row.canonicalLfSha256}\n`).join('');
  return sha256Bytes(Buffer.from(basis, 'utf8'));
}

function normalizeAuthorityNode(node) {
  if (typeof node.node_id !== 'string' || !node.node_id) throw new Error('authority node_id is required');
  return {
    nodeId: node.node_id,
    qname: node.qname || null,
    topologicalLevel: Number.isInteger(node.topological_level) ? node.topological_level : null,
    typeKind: node.type_kind || null
  };
}

function publicEntry(entry) {
  return {
    authorityNodes: entry.authorityNodes,
    module: entry.module,
    path: entry.logicalPath,
    sourceSha256: entry.sourceSha256,
    sourceSize: entry.sourceSize
  };
}

function buildDefinitions(entries) {
  const result = { application: {}, bootstrap: {} };
  entries.forEach(entry => {
    const root = MAINTAINED_ROOTS.find(candidate => candidate.module === entry.module).path;
    const relative = entry.logicalPath.slice(root.length + 1);
    const segments = relative.split('/');
    const fileName = segments.pop();
    const identifier = fileName.slice(0, -3);
    const namespace = segments.join('.');
    if (!result[entry.module][namespace]) result[entry.module][namespace] = [];
    result[entry.module][namespace].push(identifier);
  });
  Object.keys(result).forEach(module => {
    Object.keys(result[module]).forEach(namespace => {
      result[module][namespace].sort(compareUtf8);
    });
  });
  return result;
}

function relevantDefinitions(source, allDefinitions) {
  const subset = {};
  let match;
  const pattern = /\bimport\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.\*\s*;/g;
  while ((match = pattern.exec(source))) {
    subset[match[1]] = allDefinitions[match[1]] || [];
  }
  return subset;
}

function enumerateMaintainedSources(root) {
  const results = [];
  MAINTAINED_ROOTS.forEach(authorityRoot => {
    const absoluteRoot = resolveInside(root, authorityRoot.path);
    const stat = fs.lstatSync(absoluteRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`maintained root must be a real directory: ${authorityRoot.path}`);
    }
    walk(absoluteRoot, authorityRoot.path, results);
  });
  return results.sort(compareUtf8);
}

function walk(absoluteDirectory, logicalDirectory, results) {
  fs.readdirSync(absoluteDirectory).sort(compareUtf8).forEach(name => {
    const absolute = path.join(absoluteDirectory, name);
    const logical = `${logicalDirectory}/${name}`;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`symlink forbidden in maintained corpus: ${logical}`);
    if (stat.isDirectory()) return walk(absolute, logical, results);
    if (!stat.isFile()) throw new Error(`non-file corpus entry forbidden: ${logical}`);
    if (name.endsWith('.as')) results.push(normalizeLogicalPath(logical));
  });
}

function assertExactSet(expected, actual) {
  if (expected.length !== actual.length) {
    throw new Error(`manifest/disk AS3 file count mismatch: manifest=${expected.length} disk=${actual.length}`);
  }
  for (let index = 0; index < expected.length; index++) {
    if (expected[index] !== actual[index]) {
      throw new Error(`manifest/disk path mismatch at ${index}: manifest=${expected[index]} disk=${actual[index]}`);
    }
  }
}

function assertMaintainedPath(logicalPath, module) {
  const authority = MAINTAINED_ROOTS.find(candidate => candidate.module === module);
  if (!authority || !logicalPath.startsWith(`${authority.path}/`)) {
    throw new Error(`source path is outside maintained ${module} root: ${logicalPath}`);
  }
}

function normalizeLogicalPath(value) {
  if (value.includes('\\')) throw new Error(`authority paths must use forward slashes: ${value}`);
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized.startsWith('../') || normalized.startsWith('/') || normalized.includes('/../')) {
    throw new Error(`unsafe authority path: ${value}`);
  }
  return normalized;
}

function resolveInside(root, logicalPath) {
  const absolute = path.resolve(root, ...logicalPath.split('/'));
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`path escapes or aliases repository root: ${logicalPath}`);
  }
  return absolute;
}

function requireRegularFileWithoutSymlink(absolutePath, root) {
  const relativeParts = path.relative(root, absolutePath).split(path.sep);
  let current = root;
  relativeParts.forEach(part => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`symlink forbidden: ${path.relative(root, current).split(path.sep).join('/')}`);
  });
  if (!fs.statSync(absolutePath).isFile()) throw new Error(`not a regular file: ${absolutePath}`);
}

function requireSha256(value, logicalPath) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`invalid source_sha256 for ${logicalPath}`);
  }
  return value;
}

module.exports = {
  EXCLUDED_SHELL_ROOT,
  EXPECTED_BLEACH_CENSUS,
  EXPECTED_DEPENDENCY_GRAPH_SHA256,
  MAINTAINED_ROOTS,
  computeCanonicalLfSourceSet,
  authenticateDependencyGraph,
  loadAuthority,
  publicEntry,
  relevantDefinitions
};

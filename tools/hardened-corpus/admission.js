'use strict';

function hit(code, detail) {
  return detail ? { code, detail } : { code };
}

function knownSourceIssues(source) {
  const issues = [];
  if (/\bextends\s+[^\s{]+\s*\/\*/.test(source)) {
    issues.push(hit('upstream_extends_comment_hang'));
  }
  if (/\bbreak\s*(?:\/\/[^\r\n]*)?(?:\r?\n|$)/.test(source)) {
    issues.push(hit('upstream_break_without_semicolon_hang'));
  }
  if (/\([^\r\n()]*\/\*[^\r\n]*\*\/[^\r\n()]*\)/.test(source)) {
    issues.push(hit('upstream_inline_multiline_comment'));
  }
  if (/\bnamespace\s+(?:class|enum|interface|function|import|export|new|var)\b/.test(source)) {
    issues.push(hit('upstream_keyword_namespace'));
  }
  if (/\b(?:public|private|protected|internal)?\s*var\s+[A-Za-z_$][\w$]*\s*:[^;\r\n,]+,\s*[A-Za-z_$]/.test(source)) {
    issues.push(hit('upstream_multiple_property_definition'));
  }
  if (hasFunctionWithoutAccess(source)) {
    issues.push(hit('upstream_missing_access_modifier'));
  }
  if (hasConstructorSuperAfterStatement(source)) {
    issues.push(hit('upstream_constructor_super_order'));
  }
  if (/\.\.[A-Za-z_$]|\.@[A-Za-z_$]/.test(source)) {
    issues.push(hit('semantic_e4x_navigation'));
  }
  if (/\buse\s+namespace\b|\b[A-Za-z_$][\w$]*::[A-Za-z_$*]/.test(source)) {
    issues.push(hit('semantic_namespace_identity'));
  }
  if (/\bCONFIG::/.test(source)) {
    issues.push(hit('semantic_conditional_compilation'));
  }
  if (/^\s*[A-Za-z_$][\w$]*\s*:\s*(?:for|while|do|switch|\{)/m.test(source)) {
    issues.push(hit('semantic_label_control_flow'));
  }
  if (classCount(source) > 1) {
    issues.push(hit('semantic_multiple_types_per_file'));
  }
  if (hasClassWithoutExtendsAndSuper(source)) {
    issues.push(hit('semantic_super_without_extends'));
  }
  return uniqueIssues(issues);
}

function knownEmissionIssues(output) {
  const issues = [];
  const patterns = [
    ['emission_undefined_helper_import', /from\s+["']undefined[^"']*["']/],
    ['emission_legacy_binding_decorator', /@(classBound|bound)\b/],
    ['emission_namespace_selector', /\b[A-Za-z_$][\w$]*::[A-Za-z_$]/],
    ['emission_public_namespace', /\bpublic\s+namespace\b/],
    ['emission_e4x_navigation', /\.@[A-Za-z_$]|\.\.[A-Za-z_$]/],
    ['emission_uppercase_call_as_assertion', /<\s*[A-Z][\w$]*\s*>\s*\(/],
    ['emission_label_mangling', /\b(?:break|continue)\s+this\.|\bthis\.[A-Za-z_$][\w$]*\s*:/],
    ['emission_conditional_compilation', /\bCONFIG::/],
    ['emission_new_angle_form', /\bnew\s*</],
    ['emission_as3_is_operator', /\s+is\s+[A-Za-z_$]/],
    ['emission_legacy_flash_import', /from\s+["'][^"']*flash(?:\.|\/)/]
  ];
  patterns.forEach(([code, pattern]) => {
    if (pattern.test(output)) issues.push(hit(code));
  });
  if (importsAndDeclaresSameName(output)) {
    issues.push(hit('emission_import_local_declaration_collision'));
  }
  return uniqueIssues(issues);
}

function hasFunctionWithoutAccess(source) {
  return /^\s*function\s+[A-Za-z_$][\w$]*\s*\(/m.test(source);
}

function hasConstructorSuperAfterStatement(source) {
  const classMatch = /\bclass\s+([A-Za-z_$][\w$]*)/.exec(source);
  if (!classMatch) return false;
  const name = escapeRegExp(classMatch[1]);
  const constructor = new RegExp('\\bfunction\\s+' + name + '\\s*\\([^)]*\\)\\s*(?::\\s*[^\\s{]+)?\\s*\\{([\\s\\S]*?)\\}', 'm').exec(source);
  if (!constructor) return false;
  const body = stripLeadingTrivia(constructor[1]);
  const superIndex = body.search(/\bsuper\s*\(/);
  if (superIndex < 0) return false;
  return /\S/.test(body.slice(0, superIndex));
}

function hasClassWithoutExtendsAndSuper(source) {
  const declaration = /\bclass\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[A-Za-z_$][\w$.:]*)?/.exec(source);
  return Boolean(declaration && !/\bextends\b/.test(declaration[0]) && /\bsuper\s*\(/.test(source));
}

function classCount(source) {
  const matches = source.match(/\bclass\s+[A-Za-z_$][\w$]*/g);
  return matches ? matches.length : 0;
}

function importsAndDeclaresSameName(output) {
  const imports = new Set();
  let match;
  const importPattern = /import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from/g;
  while ((match = importPattern.exec(output))) imports.add(match[1]);
  const declarationPattern = /\b(?:class|interface)\s+([A-Za-z_$][\w$]*)/g;
  while ((match = declarationPattern.exec(output))) {
    if (imports.has(match[1])) return true;
  }
  return false;
}

function stripLeadingTrivia(value) {
  let previous;
  do {
    previous = value;
    value = value.replace(/^\s+/, '').replace(/^\/\/[^\r\n]*(?:\r?\n|$)/, '').replace(/^\/\*[\s\S]*?\*\//, '');
  } while (value !== previous);
  return value;
}

function uniqueIssues(issues) {
  const seen = new Set();
  return issues.filter(issue => {
    if (seen.has(issue.code)) return false;
    seen.add(issue.code);
    return true;
  }).sort((left, right) => left.code.localeCompare(right.code));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { knownEmissionIssues, knownSourceIssues };

'use strict';

const crypto = require('crypto');

function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('canonical JSON rejects non-finite numbers');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const result = {};
  Object.keys(value).sort(compareUtf8).forEach(key => {
    if (value[key] !== undefined) {
      result[key] = canonicalize(value[key]);
    }
  });
  return result;
}

function stringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Json(value) {
  return sha256Bytes(Buffer.from(stringify(value), 'utf8'));
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

module.exports = { canonicalize, compareUtf8, sha256Bytes, sha256Json, stringify };

// The incoming tests use the TypeScript JavaScript API, which is no longer
// exported by the native TypeScript 7 CLI used for the hardened build.
const Module = require('node:module');
const original = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  return original.call(this, request === 'typescript' ? 'typescript-native' : request, parent, ...rest);
};

const preload = "--require " + JSON.stringify(__filename);
if (!(process.env.NODE_OPTIONS || "").includes(__filename)) {
  process.env.NODE_OPTIONS = ((process.env.NODE_OPTIONS || "") + " " + preload).trim();
}

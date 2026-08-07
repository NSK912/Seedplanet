const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const distLoaderPath = path.resolve(__dirname, '../dist/loader.js');

if (fs.existsSync(distLoaderPath)) {
  const code = fs.readFileSync(distLoaderPath, 'utf8');
  const obfuscatedResult = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 3,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 1.0,
    unicodeEscapeSequence: false
  });

  fs.writeFileSync(distLoaderPath, obfuscatedResult.getObfuscatedCode(), 'utf8');
  console.log('Successfully obfuscated dist/loader.js for GitHub Pages build!');
} else {
  console.warn('dist/loader.js not found for obfuscation.');
}

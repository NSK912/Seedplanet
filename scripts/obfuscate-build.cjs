const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const distLoaderPath = path.resolve(__dirname, '../dist/loader.js');

if (fs.existsSync(distLoaderPath)) {
  const code = fs.readFileSync(distLoaderPath, 'utf8');
  const obfuscatedResult = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 4,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.8,
    unicodeEscapeSequence: false
  });

  fs.writeFileSync(distLoaderPath, obfuscatedResult.getObfuscatedCode(), 'utf8');
  console.log('Successfully obfuscated dist/loader.js for GitHub Pages build!');
} else {
  console.warn('dist/loader.js not found for obfuscation.');
}

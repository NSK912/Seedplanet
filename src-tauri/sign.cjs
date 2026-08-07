const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

function findSignTool() {
  // 1. Check if signtool is in PATH or findable via where.exe
  try {
    const whereResult = execSync('where signtool', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (whereResult) {
      const firstPath = whereResult.split(/\r?\n/)[0].trim();
      if (fs.existsSync(firstPath)) return { type: 'signtool', path: firstPath };
    }
  } catch (e) {
    // Ignore where.exe error
  }

  // 2. Common Windows Kit directories
  const baseDirs = [
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin",
    "C:\\Program Files\\Windows Kits\\10\\bin",
    "C:\\Program Files (x86)\\Microsoft SDKs\\Windows"
  ];

  const candidates = [];
  function search(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          search(fullPath);
        } else if (file.toLowerCase() === 'signtool.exe') {
          candidates.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  for (const dir of baseDirs) {
    search(dir);
  }

  if (candidates.length > 0) {
    const x64Match = candidates.find(p => p.toLowerCase().includes('\\x64\\'));
    if (x64Match) return { type: 'signtool', path: x64Match };
    const x86Match = candidates.find(p => p.toLowerCase().includes('\\x86\\'));
    if (x86Match) return { type: 'signtool', path: x86Match };
    return { type: 'signtool', path: candidates[0] };
  }

  // 3. Check for osslsigncode on Linux/macOS
  try {
    const osslResult = execSync('which osslsigncode', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (osslResult && fs.existsSync(osslResult)) {
      return { type: 'osslsigncode', path: osslResult };
    }
  } catch (e) {
    // Ignore
  }

  return null;
}

const binaryPath = process.argv[2];
if (!binaryPath) {
  console.error("Error: No binary path specified as argument.");
  process.exit(1);
}

console.log(`Attempting to sign binary: ${binaryPath}`);

const pfxBase64 = process.env.STORE_PFX_BASE64;
const pfxPassword = process.env.STORE_PFX_PASSWORD;

if (!pfxBase64 || !pfxPassword) {
  console.log("NOTE: STORE_PFX_BASE64 or STORE_PFX_PASSWORD environment variables are not set. Skipping code signing successfully.");
  process.exit(0);
}

// Decode base64 to certificate file
const tempCertPath = path.join(__dirname, 'temp_signing_cert.pfx');
try {
  const cleanBase64 = pfxBase64.replace(/\s+/g, '');
  const pfxBuffer = Buffer.from(cleanBase64, 'base64');
  fs.writeFileSync(tempCertPath, pfxBuffer);
  console.log(`Decoded PFX certificate (${pfxBuffer.length} bytes) to: ${tempCertPath}`);

  // Find signing tool
  const tool = findSignTool();
  if (!tool) {
    console.warn("WARNING: Neither signtool.exe nor osslsigncode could be found. Code signing skipped.");
    process.exit(0);
  }
  console.log(`Using signing tool (${tool.type}): ${tool.path}`);

  // Try timestamp servers
  const timestampServers = [
    "http://timestamp.digicert.com",
    "http://timestamp.sectigo.com",
    "http://timestamp.comodoca.com",
    "http://timestamp.globalsign.com/scripts/timstamp.dll"
  ];

  let signedSuccessfully = false;

  if (tool.type === 'signtool') {
    for (const tsServer of timestampServers) {
      console.log(`Trying timestamp server: ${tsServer}`);
      try {
        const args = [
          'sign',
          '/f', tempCertPath,
          '/p', pfxPassword,
          '/fd', 'sha256',
          '/tr', tsServer,
          '/td', 'sha256',
          binaryPath
        ];
        execFileSync(tool.path, args, { stdio: 'inherit' });
        console.log(`SUCCESS: Binary signed successfully using signtool and ${tsServer}!`);
        signedSuccessfully = true;
        break;
      } catch (err) {
        console.warn(`Timestamp server ${tsServer} failed or timed out.`, err.message || '');
      }
    }
  } else if (tool.type === 'osslsigncode') {
    const signedPath = binaryPath + '.signed';
    for (const tsServer of timestampServers) {
      console.log(`Trying timestamp server with osslsigncode: ${tsServer}`);
      try {
        const args = [
          'sign',
          '-pkcs12', tempCertPath,
          '-pass', pfxPassword,
          '-h', 'sha256',
          '-t', tsServer,
          '-in', binaryPath,
          '-out', signedPath
        ];
        execFileSync(tool.path, args, { stdio: 'inherit' });
        fs.renameSync(signedPath, binaryPath);
        console.log(`SUCCESS: Binary signed successfully using osslsigncode and ${tsServer}!`);
        signedSuccessfully = true;
        break;
      } catch (err) {
        console.warn(`osslsigncode with ${tsServer} failed.`, err.message || '');
        if (fs.existsSync(signedPath)) fs.unlinkSync(signedPath);
      }
    }
  }

  if (!signedSuccessfully) {
    console.error("ERROR: Could not sign binary with any timestamp server.");
    process.exit(1);
  }
} catch (error) {
  console.error("ERROR: Code signing failed:", error.message);
  process.exit(1);
} finally {
  // Clean up the temporary certificate file for security
  if (fs.existsSync(tempCertPath)) {
    try {
      fs.unlinkSync(tempCertPath);
      console.log("Cleaned up temporary PFX certificate file.");
    } catch (err) {
      console.warn("Warning: Failed to clean up temporary PFX file:", err.message);
    }
  }
}



'use strict';

/**
 * Windows DPAPI CurrentUser encryption for local-only secrets.
 * PowerShell receives the secret through stdin, never command-line args.
 * This module does not expose credential bytes to the browser or plugin.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HEADER = 'dpapi-v1:';
const MAX_SECRET_BYTES = 16384;

const PS_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  'Add-Type -AssemblyName System.Security',
  '$raw = [Console]::In.ReadToEnd()',
  '$bytes = [Convert]::FromBase64String($raw.Trim())',
  'if ($args.Count -gt 0) { throw "Unexpected args" }',
  '$mode = "__MODE__"',
  'if ($mode -eq "protect") {',
  '  $result = [Security.Cryptography.ProtectedData]::Protect(',
  '    $bytes, $null,',
  '    [Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '} else {',
  '  $result = [Security.Cryptography.ProtectedData]::Unprotect(',
  '    $bytes, $null,',
  '    [Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '}',
  '[Console]::Out.Write([Convert]::ToBase64String($result))'
].join('\n');

function dpapi(mode, data, spawn = spawnSync) {
  if (process.platform !== 'win32') {
    throw Error('DPAPI is available on Windows only');
  }
  if (!Buffer.isBuffer(data) || data.length > MAX_SECRET_BYTES) {
    throw Error('Invalid secret size');
  }
  if (mode !== 'protect' && mode !== 'unprotect') {
    throw Error('Unknown DPAPI operation');
  }
  const script = PS_SCRIPT.replace('__MODE__', mode);
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawn('powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive',
      '-EncodedCommand', encoded], {
      input: data.toString('base64'), encoding: 'utf8',
      windowsHide: true, timeout: 15000, maxBuffer: 65536
    });
  if (result.error || result.status !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test((result.stdout || '').trim())) {
    // Never print stdin; stderr contains only PowerShell diagnostics.
    const code = String(result.status ?? 'spawn-error');
    const diagnostic = String(result.stderr || result.error?.code || '')
      .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '[redacted]')
      .slice(0, 300);
    throw Error(process.env.CI === 'true' ?
      'Windows credential protection failed [' + code +
        ']: ' + diagnostic :
      'Windows credential protection failed');
  }
  const output = Buffer.from(result.stdout.trim(), 'base64');
  if (output.length > MAX_SECRET_BYTES) {
    throw Error('Protected credential exceeds limit');
  }
  return output;
}

function atomicWrite(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = target + '.new-' + process.pid;
  try {
    fs.writeFileSync(temp, contents, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, target);
  } finally {
    try { fs.unlinkSync(temp); } catch { /* already renamed */ }
  }
}

function protectFile(target, plaintext) {
  if (typeof plaintext !== 'string' ||
      Buffer.byteLength(plaintext, 'utf8') > MAX_SECRET_BYTES) {
    throw Error('Invalid credential data');
  }
  const ciphertext = dpapi('protect', Buffer.from(plaintext, 'utf8'));
  atomicWrite(target, HEADER + ciphertext.toString('base64') + '\n');
}

function unprotectFile(target) {
  const raw = fs.readFileSync(target, 'utf8').trim();
  if (!raw.startsWith(HEADER)) {
    throw Error('Unknown credential format');
  }
  const value = raw.slice(HEADER.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw Error('Invalid protected credential');
  }
  return dpapi('unprotect', Buffer.from(value, 'base64'))
    .toString('utf8');
}

/**
 * One-time legacy migration happens only after a successful DPAPI write.
 * A failure leaves the original file untouched and aborts startup.
 */
function loadOrMigrate(target, legacyPath, validate, createValue) {
  if (fs.existsSync(target)) {
    const value = unprotectFile(target);
    if (!validate(value)) throw Error('Invalid protected credential');
    return value;
  }
  if (fs.existsSync(legacyPath)) {
    const value = fs.readFileSync(legacyPath, 'utf8').trim();
    if (!validate(value)) throw Error('Invalid legacy credential');
    protectFile(target, value);
    fs.unlinkSync(legacyPath);
    return value;
  }
  const value = createValue();
  if (!validate(value)) throw Error('Generated credential invalid');
  protectFile(target, value);
  return value;
}

module.exports = { protectFile, unprotectFile, loadOrMigrate };

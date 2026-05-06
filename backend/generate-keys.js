const fs = require('fs');
const path = require('path');
const bigintCryptoUtils = require('bigint-crypto-utils');

/**
 * Key Generation Script
 * ---------------------
 * This script is used to generate new versioned RSA keys.
 * Run this manually from the command line when you need to create a new key
 * for the initial setup or for key rotation.
 *
 * Usage: node backend/generate-keys.js
 */

console.log("Starting key generation process...");

// Define the directory where keys will be stored.
const keysDir = path.join(__dirname, 'keys');

// Create the 'keys' directory if it doesn't exist.
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
    console.log("Created 'keys' directory.");
}

// Determine the next key version.
const existingKeys = fs.readdirSync(keysDir).filter(file => file.startsWith('rsa_key_v'));
const nextVersion = existingKeys.length + 1;
const keyFileName = `rsa_key_v${nextVersion}.json`;
const keyFilePath = path.join(keysDir, keyFileName);

console.log(`Generating new key: Version ${nextVersion}`);

// 1. GENERATION: Generate large prime numbers for the new key.
const p = bigintCryptoUtils.primeSync(128);
const q = bigintCryptoUtils.primeSync(128);
const n = p * q;
const e = 65537n; // Standard public exponent.

const keyData = {
    p: p.toString(),
    q: q.toString(),
    n: n.toString(),
    e: e.toString(),
};

// Save the new key to its versioned file.
fs.writeFileSync(keyFilePath, JSON.stringify(keyData, null, 2));

console.log(`SUCCESS: New key pair (Version ${nextVersion}) generated and saved to ${keyFilePath}`);
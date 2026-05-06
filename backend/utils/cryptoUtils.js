const fs = require('fs');
const path = require('path');
const bigintCryptoUtils = require('bigint-crypto-utils');

/**
 * Rotation-Aware Crypto Module
 * ----------------------------
 * This module handles loading all available keys and uses them for
 * encryption and decryption, supporting key rotation.
 */

// This object will hold all loaded keys, indexed by version (e.g., 'v1', 'v2').
const keys = {}; 
let primaryKeyVersion; // This will store the version of the key to be used for new encryptions.

try {
    // 2. DISTRIBUTION (Loading): Load all keys from the 'keys' directory.
    const keysDir = path.join(__dirname, '..', 'keys');
    const keyFiles = fs.readdirSync(keysDir).filter(file => file.startsWith('rsa_key_v') && file.endsWith('.json'));

    if (keyFiles.length === 0) {
        throw new Error("No key files found in /keys directory. Please run 'node backend/generate-keys.js' to create a key.");
    }

    for (const file of keyFiles) {
        const version = `v${file.split('_v')[1].split('.')[0]}`;
        const keyData = JSON.parse(fs.readFileSync(path.join(keysDir, file), 'utf8'));
        
        const p = BigInt(keyData.p);
        const q = BigInt(keyData.q);
        const e = BigInt(keyData.e);
        const n = BigInt(keyData.n);
        const phi_n = (p - 1n) * (q - 1n);

        // Calculate the private exponent 'd' for this key version.
        const d = bigintCryptoUtils.modInv(e, phi_n);

        keys[version] = { n, e, d };
    }

    // 4. ROTATION (Primary Key Selection): The primary key for new encryptions is the one with the highest version number.
    primaryKeyVersion = `v${Math.max(...Object.keys(keys).map(v => parseInt(v.substring(1))))}`;
    console.log(`RSA keys loaded. Primary key for new encryptions is ${primaryKeyVersion}.`);

} catch (error) {
    console.error("FATAL ERROR: Could not load or initialize RSA keys.");
    console.error(error.message);
    // The application cannot run without keys, so we exit.
    process.exit(1); 
}

// --- Helper Function ---
const power = (base, exp, mod) => {
    let res = 1n;
    base %= mod;
    while (exp > 0) {
        if (exp % 2n === 1n) res = (res * base) % mod;
        exp >>= 1n;
        base = (base * base) % mod;
    }
    return res;
};

// --- Encryption and Decryption Functions ---

const rsaEncrypt = (text) => {
    if (text === null || typeof text === 'undefined') return null;
    
    // 4. ROTATION (Encryption): Always encrypt using the latest (primary) key.
    const primaryKey = keys[primaryKeyVersion];
    const m = BigInt('0x' + Buffer.from(text.toString(), 'utf8').toString('hex'));
    const c = power(m, primaryKey.e, primaryKey.n);
    
    // Prepend the key version to the ciphertext. This is essential for rotation.
    return `${primaryKeyVersion}:${c.toString()}`;
};

const rsaDecrypt = (versionedCiphertext) => {
    if (!versionedCiphertext) return null;
    
    // 4. ROTATION (Decryption): Identify the key version from the ciphertext.
    const parts = versionedCiphertext.split(':');
    
    let version, ciphertext;
    
    if (parts.length !== 2) {
        // This handles legacy data that was encrypted before versioning was introduced.
        // We assume it was encrypted with the first key.
        version = 'v1';
        ciphertext = versionedCiphertext;
    } else {
        [version, ciphertext] = parts;
    }

    const key = keys[version];

    if (!key) {
        console.error(`Decryption failed: Key version "${version}" not found.`);
        return `[DECRYPTION_ERROR: KEY ${version} MISSING]`;
    }

    const c = BigInt(ciphertext);
    const m = power(c, key.d, key.n);
    const hex = m.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    
    return Buffer.from(paddedHex, 'hex').toString('utf8');
};

module.exports = { rsaEncrypt, rsaDecrypt };
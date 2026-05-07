const fs = require('fs');
const path = require('path');
const bigintCryptoUtils = require('bigint-crypto-utils');

/**
 * Rotation-Aware Crypto Module
 * ----------------------------
 * Handles RSA and ECC encryption/decryption with key rotation support.
 */

const rsaKeys = {};
const eccKeys = {};
let primaryRSAKeyVersion;
let primaryECCKeyVersion;

const keysDir = path.join(__dirname, '..', 'keys');

// Helper to load keys
function loadKeys() {
    if (!fs.existsSync(keysDir)) {
        console.warn("Keys directory not found. Please run 'node backend/generate-keys.js'.");
        return;
    }

    const files = fs.readdirSync(keysDir);

    // Load RSA Keys
    const rsaFiles = files.filter(file => file.startsWith('rsa_key_v') && file.endsWith('.json'));
    for (const file of rsaFiles) {
        const version = `v${file.split('_v')[1].split('.')[0]}`;
        const keyData = JSON.parse(fs.readFileSync(path.join(keysDir, file), 'utf8'));
        
        const p = BigInt(keyData.p);
        const q = BigInt(keyData.q);
        const e = BigInt(keyData.e);
        const n = BigInt(keyData.n);
        const phi_n = (p - 1n) * (q - 1n);
        const d = bigintCryptoUtils.modInv(e, phi_n);

        rsaKeys[version] = { n, e, d };
    }
    if (Object.keys(rsaKeys).length > 0) {
        primaryRSAKeyVersion = `v${Math.max(...Object.keys(rsaKeys).map(v => parseInt(v.substring(1))))}`;
    }

    // Load ECC Keys
    const eccFiles = files.filter(file => file.startsWith('ecc_key_v') && file.endsWith('.json'));
    for (const file of eccFiles) {
        const version = `v${file.split('_v')[1].split('.')[0]}`;
        const keyData = JSON.parse(fs.readFileSync(path.join(keysDir, file), 'utf8'));
        
        const p = BigInt(keyData.p);
        const a = BigInt(keyData.a);
        const b = BigInt(keyData.b);
        const gx = BigInt(keyData.gx);
        const gy = BigInt(keyData.gy);
        const d = BigInt(keyData.d);
        
        const G = { x: gx, y: gy };
        // Public key Q = dG
        const Q = scalarMult(d, G, a, p);

        eccKeys[version] = { p, a, b, G, d, Q };
    }
    if (Object.keys(eccKeys).length > 0) {
        primaryECCKeyVersion = `v${Math.max(...Object.keys(eccKeys).map(v => parseInt(v.substring(1))))}`;
    }
}

// --- RSA Helper ---
const power = (base, exp, mod) => {
    return bigintCryptoUtils.modPow(base, exp, mod);
};

// --- ECC Algorithms (translated from Python lab) ---

function pointAdd(P, Q, a, p) {
    if (P === null) return Q;
    if (Q === null) return P;
    
    // Check if Q is negative of P (point at infinity)
    if (P.x === Q.x && (P.y === (p - Q.y) % p)) return null;

    let m;
    if (P.x === Q.x && P.y === Q.y) {
        // Point doubling
        const num = (3n * P.x ** 2n + a) % p;
        const den = bigintCryptoUtils.modInv(2n * P.y, p);
        m = (num * den) % p;
    } else {
        // Point addition
        const num = (Q.y - P.y + p) % p;
        const den = bigintCryptoUtils.modInv((Q.x - P.x + p) % p, p);
        m = (num * den) % p;
    }

    const xr = (m ** 2n - P.x - Q.x + 2n * p) % p;
    const yr = (m * (P.x - xr + p) - P.y + p) % p;

    return { x: xr, y: yr };
}

function scalarMult(k, P, a, p) {
    let R = null;
    let base = P;
    let tempK = k;

    while (tempK > 0n) {
        if (tempK % 2n === 1n) {
            R = pointAdd(R, base, a, p);
        }
        base = pointAdd(base, base, a, p);
        tempK >>= 1n;
    }
    return R;
}

// --- RSA Functions ---

const rsaEncrypt = (text) => {
    if (!text || !primaryRSAKeyVersion) return null;
    const key = rsaKeys[primaryRSAKeyVersion];
    const m = BigInt('0x' + Buffer.from(text.toString(), 'utf8').toString('hex'));
    const c = power(m, key.e, key.n);
    // Modified: Added rsa_ prefix to differentiate from ECC
    return `rsa_${primaryRSAKeyVersion}:${c.toString()}`;
};

const rsaDecrypt = (versionedCiphertext) => {
    if (!versionedCiphertext) return null;
    
    // Compatibility: Handle old formats or non-encrypted strings
    if (!versionedCiphertext.includes(':')) return versionedCiphertext;

    const [prefix, ciphertext] = versionedCiphertext.split(':');
    
    // Modified: Differentiate between rsa_vX and legacy vX
    let version;
    if (prefix.startsWith('rsa_')) {
        version = prefix.split('rsa_')[1];
    } else if (prefix.startsWith('v') && !prefix.startsWith('ecc_')) {
        // Fallback for legacy RSA v1:...
        version = prefix;
    } else {
        return versionedCiphertext; // Not an RSA ciphertext
    }

    const key = rsaKeys[version];
    if (!key) return `[RSA_DECRYPTION_ERROR: KEY ${version} MISSING]`;

    const c = BigInt(ciphertext);
    const m = power(c, key.d, key.n);
    let hex = m.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    return Buffer.from(hex, 'hex').toString('utf8');
};

// --- ECC Functions ---

const eccEncrypt = (text) => {
    if (!text || !primaryECCKeyVersion) return null;
    const key = eccKeys[primaryECCKeyVersion];
    
    // Convert text to BigInt
    const m = BigInt('0x' + Buffer.from(text.toString(), 'utf8').toString('hex'));
    
    // Choose random k
    const k = bigintCryptoUtils.randBetween(key.p - 1n);
    
    // C1 = kG
    const C1 = scalarMult(k, key.G, key.a, key.p);
    
    // Shared secret S = kQ
    const S = scalarMult(k, key.Q, key.a, key.p);
    
    // Simple encryption: XOR message with shared secret's x-coordinate
    // C2 = M XOR S.x
    const C2 = m ^ S.x;
    
    // Modified: Added ecc_ prefix to differentiate from RSA
    return `ecc_${primaryECCKeyVersion}:${C1.x.toString()},${C1.y.toString()},${C2.toString()}`;
};

const eccDecrypt = (versionedCiphertext) => {
    if (!versionedCiphertext) return null;
    
    // Compatibility check
    if (!versionedCiphertext.includes(':')) return versionedCiphertext;

    const [prefix, ciphertext] = versionedCiphertext.split(':');
    
    if (!prefix.startsWith('ecc_')) {
        // Not an ECC ciphertext
        return versionedCiphertext;
    }

    const version = prefix.split('ecc_')[1];
    const key = eccKeys[version];
    if (!key) return `[ECC_DECRYPTION_ERROR: KEY ${version} MISSING]`;
    
    try {
        const [c1x, c1y, c2] = ciphertext.split(',').map(BigInt);
        const C1 = { x: c1x, y: c1y };
        const C2 = c2;
        
        // Recover shared secret S = dC1
        const S = scalarMult(key.d, C1, key.a, key.p);
        
        // Recover message M = C2 XOR S.x
        const m = C2 ^ S.x;
        
        let hex = m.toString(16);
        if (hex.length % 2 !== 0) hex = '0' + hex;
        return Buffer.from(hex, 'hex').toString('utf8');
    } catch (e) {
        return `[ECC_DECRYPTION_ERROR: INVALID FORMAT]`;
    }
};

/**
 * Unified Decrypt
 * ----------------
 * Automatically detects the algorithm (RSA/ECC) and version from the prefix.
 */
const decrypt = (ciphertext) => {
    if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
    
    if (ciphertext.startsWith('rsa_') || (ciphertext.startsWith('v') && !ciphertext.startsWith('ecc_'))) {
        return rsaDecrypt(ciphertext);
    }
    
    if (ciphertext.startsWith('ecc_')) {
        return eccDecrypt(ciphertext);
    }
    
    // Return original if no encryption prefix found
    return ciphertext;
};

// Initialize
loadKeys();

module.exports = { 
    rsaEncrypt, 
    rsaDecrypt,
    eccEncrypt,
    eccDecrypt,
    decrypt
};
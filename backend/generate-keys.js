const fs = require('fs');
const path = require('path');
const bigintCryptoUtils = require('bigint-crypto-utils');

/**
 * Key Generation Script
 * ---------------------
 * This script is used to generate new versioned RSA and ECC keys.
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

async function generateRSAKey() {
    const existingKeys = fs.readdirSync(keysDir).filter(file => file.startsWith('rsa_key_v'));
    const nextVersion = existingKeys.length + 1;
    const keyFileName = `rsa_key_v${nextVersion}.json`;
    const keyFilePath = path.join(keysDir, keyFileName);

    console.log(`Generating new RSA key: Version ${nextVersion}`);

    const p = await bigintCryptoUtils.prime(256); // Increased bit length for better security
    const q = await bigintCryptoUtils.prime(256);
    const n = p * q;
    const e = 65537n;

    const keyData = {
        type: 'rsa',
        p: p.toString(),
        q: q.toString(),
        n: n.toString(),
        e: e.toString(),
        version: nextVersion
    };

    fs.writeFileSync(keyFilePath, JSON.stringify(keyData, null, 2));
    console.log(`SUCCESS: RSA key pair (Version ${nextVersion}) saved to ${keyFileName}`);
}

async function generateECCKey() {
    const existingKeys = fs.readdirSync(keysDir).filter(file => file.startsWith('ecc_key_v'));
    const nextVersion = existingKeys.length + 1;
    const keyFileName = `ecc_key_v${nextVersion}.json`;
    const keyFilePath = path.join(keysDir, keyFileName);

    console.log(`Generating new ECC key: Version ${nextVersion}`);

    // ECC parameters inspired by the lab: y^2 = x^3 - 2x + 2 (mod p)
    // Using a large prime for practical string encryption
    let p;
    while (true) {
        p = await bigintCryptoUtils.prime(256);
        if (p % 4n === 3n) break;
    }
    
    const a = -2n;
    const b = 2n;

    // Find a generator point G (simplified point finding)
    let gx, gy;
    while (true) {
        gx = await bigintCryptoUtils.randBetween(p - 1n);
        const rhs = (gx ** 3n + a * gx + b) % p;
        // Check if rhs is a quadratic residue (Legendre symbol)
        if (bigintCryptoUtils.modPow(rhs, (p - 1n) / 2n, p) === 1n) {
            // Since p % 4 == 3, sqrt(rhs) = rhs^((p+1)/4) mod p
            gy = bigintCryptoUtils.modPow(rhs, (p + 1n) / 4n, p);
            break;
        }
    }

    // Private key d
    const d = await bigintCryptoUtils.randBetween(p - 1n);
    
    // Public key Q = dG
    // (We need the point multiplication algorithm here, which we'll also put in cryptoUtils)
    // For generation purposes, we'll store the generator and private key.
    // The public key Q will be calculated during initialization in cryptoUtils.

    const keyData = {
        type: 'ecc',
        p: p.toString(),
        a: a.toString(),
        b: b.toString(),
        gx: gx.toString(),
        gy: gy.toString(),
        d: d.toString(), // private key
        version: nextVersion
    };

    fs.writeFileSync(keyFilePath, JSON.stringify(keyData, null, 2));
    console.log(`SUCCESS: ECC key pair (Version ${nextVersion}) saved to ${keyFileName}`);
}

async function run() {
    try {
        await generateRSAKey();
        await generateECCKey();
        console.log("All keys generated successfully.");
    } catch (error) {
        console.error("Error during key generation:", error);
    }
}

run();
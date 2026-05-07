const crypto = require('crypto');
const bcrypt = require('bcrypt');

const SHA512_PREFIX = 'sha512';
const HASH_ITERATIONS = 120000;
const SALT_BYTES = 16;

const deriveSha512Hash = (password, salt, iterations = HASH_ITERATIONS) => {
    return crypto.pbkdf2Sync(String(password), salt, iterations, 64, 'sha512').toString('hex');
};

const hashPassword = async (password) => {
    if (password === undefined || password === null) {
        return null;
    }

    const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
    const hash = deriveSha512Hash(password, salt);

    return `${SHA512_PREFIX}$${HASH_ITERATIONS}$${salt}$${hash}`;
};

const compareSha512 = (plainPassword, storedHash) => {
    if (storedHash.startsWith(`${SHA512_PREFIX}$`)) {
        const parts = storedHash.split('$');

        if (parts.length !== 4) {
            return false;
        }

        const [, iterationsText, salt, expectedHash] = parts;
        const iterations = Number.parseInt(iterationsText, 10);

        if (!Number.isFinite(iterations) || !salt || !expectedHash) {
            return false;
        }

        const digest = deriveSha512Hash(plainPassword, salt, iterations);
        return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(expectedHash, 'hex'));
    }

    const digest = crypto
        .createHash('sha512')
        .update(String(plainPassword), 'utf8')
        .digest('hex');

    const expectedHash = storedHash.startsWith(`${SHA512_PREFIX}:`)
        ? storedHash.slice(`${SHA512_PREFIX}:`.length)
        : storedHash;

    if (expectedHash.length !== digest.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(digest, 'hex'),
        Buffer.from(expectedHash, 'hex')
    );
};

const comparePassword = async (plainPassword, storedHash) => {
    if (plainPassword === undefined || plainPassword === null || !storedHash) {
        return false;
    }

    if (storedHash.startsWith('$2')) {
        return bcrypt.compare(String(plainPassword), storedHash);
    }

    if (storedHash.startsWith(`${SHA512_PREFIX}$`) || storedHash.startsWith(`${SHA512_PREFIX}:`)) {
        return compareSha512(plainPassword, storedHash);
    }

    if (/^[a-f0-9]{64}$/i.test(storedHash)) {
        return compareSha512(plainPassword, storedHash);
    }

    return false;
};

module.exports = {
    hashPassword,
    comparePassword,
};
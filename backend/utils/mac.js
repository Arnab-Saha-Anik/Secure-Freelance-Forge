const crypto = require("crypto");

const BLOCK_SIZE = 16;
const ZERO_IV = Buffer.alloc(16, 0);
const MAC_ALGORITHM = "aes-256-cbc";

const getMacKey = () => {
  const material = process.env.MESSAGE_MAC_KEY || process.env.JWT_SECRET;

  if (!material) {
    throw new Error("MESSAGE_MAC_KEY or JWT_SECRET is required for message MAC generation.");
  }

  return crypto.createHash("sha256").update(String(material)).digest();
};

const toLengthPrefixedBuffer = (value) => {
  const data = Buffer.from(String(value ?? ""), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, data]);
};

const buildMacPayload = (parts) => {
  const buffers = [Buffer.from("FFMSG-MAC", "utf8")];

  for (const part of parts) {
    buffers.push(toLengthPrefixedBuffer(part));
  }

  return Buffer.concat(buffers);
};

const applyPkcs7Padding = (buffer) => {
  const remainder = buffer.length % BLOCK_SIZE;
  const paddingLength = remainder === 0 ? BLOCK_SIZE : BLOCK_SIZE - remainder;
  return Buffer.concat([buffer, Buffer.alloc(paddingLength, paddingLength)]);
};

const generateMessageMac = (parts) => {
  const key = getMacKey();
  const payload = applyPkcs7Padding(buildMacPayload(parts));
  const cipher = crypto.createCipheriv(MAC_ALGORITHM, key, ZERO_IV);
  cipher.setAutoPadding(false);

  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return encrypted.subarray(-BLOCK_SIZE).toString("hex");
};

const verifyMessageMac = (parts, mac) => {
  if (!mac) {
    return false;
  }

  const expected = Buffer.from(generateMessageMac(parts), "hex");
  const provided = Buffer.from(String(mac), "hex");

  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
};

module.exports = {
  generateMessageMac,
  verifyMessageMac,
};
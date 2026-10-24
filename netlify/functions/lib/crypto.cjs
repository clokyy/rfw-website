const crypto = require('node:crypto');
function derive(secret, purpose) {
 if (!secret) throw new Error('Security key is not configured');
 return Buffer.from(crypto.hkdfSync('sha256', secret, 'rfw-security-v2', purpose, 32));
}
const legacySecret = () => process.env.LEGACY_ENCRYPTION_SECRET || process.env.SESSION_SECRET;
function independent(value){if(!value||value.length<32)throw new Error('Independent keys must contain at least 32 characters');return value}
const signingKey = () => derive(process.env.SESSION_SIGNING_KEY ? independent(process.env.SESSION_SIGNING_KEY) : process.env.SESSION_SECRET, 'session-signing');
function storageKey(keyId) {
 if (keyId === 'data-key') return derive(independent(process.env.DATA_ENCRYPTION_KEY), 'record-encryption');
 if (keyId === 'legacy-root') return derive(legacySecret(), 'record-encryption');
 throw new Error('Unknown encryption key identifier');
}
function encryptRecord(value, purpose = 'records') {
 const keyId = process.env.DATA_ENCRYPTION_KEY ? 'data-key' : 'legacy-root';
 const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', storageKey(keyId), iv);
 c.setAAD(Buffer.from(purpose));
 const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
 return {version:2, algorithm:'aes-256-gcm', keyId, iv:iv.toString('base64'), tag:c.getAuthTag().toString('base64'), data:data.toString('base64')};
}
function decryptRecord(record, purpose = 'records') {
 if (!record || ![1,2].includes(record.version)) throw new Error('Unsupported encrypted record');
 const key = record.version === 1 ? crypto.createHash('sha256').update(legacySecret()).digest() : storageKey(record.keyId);
 const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
 if (record.version === 2) d.setAAD(Buffer.from(purpose));
 d.setAuthTag(Buffer.from(record.tag, 'base64'));
 return JSON.parse(Buffer.concat([d.update(Buffer.from(record.data, 'base64')), d.final()]).toString('utf8'));
}
module.exports = {derive, signingKey, encryptRecord, decryptRecord};

const crypto = require('node:crypto');
const {encryptRecord,decryptRecord,derive} = require('./crypto.cjs');
const {github,BRANCH,safeEqual} = require('../_lib.cjs');
const FILE = 'data/security.enc.json', ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes) {
 let bits=0,value=0,result='';
 for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=ALPHABET[(value>>>(bits-5))&31];bits-=5}}
 if(bits)result+=ALPHABET[(value<<(5-bits))&31];return result;
}
function unbase32(text){let bits=0,value=0,out=[];for(const c of text){const n=ALPHABET.indexOf(c);if(n<0)throw Error('Invalid secret');value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}return Buffer.from(out)}
function totp(secret,step=Math.floor(Date.now()/30000)){
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const digest=crypto.createHmac('sha1',unbase32(secret)).update(counter).digest(),offset=digest[19]&15;
 return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
function matchStep(secret,code,lastStep=-1,now=Date.now()){
 if(!/^\d{6}$/.test(code))return null;const step=Math.floor(now/30000);
 for(const n of [step,step-1,step+1])if(n>lastStep&&safeEqual(code,totp(secret,n)))return n;
 return null;
}
const accountKey = user => crypto.createHash('sha256').update(String(user.id)+'\0'+user.username).digest('hex');
// Binding owner MFA to password version would let a password reset remove MFA: do not do that.
const recoveryHash = code => crypto.createHash('sha256').update('rfw-recovery:'+String(code).trim().toUpperCase()).digest('hex');
async function readSecurity(){
 try{const f=await github(`contents/${FILE}?ref=${encodeURIComponent(BRANCH)}`);const accounts=decryptRecord(JSON.parse(Buffer.from(f.content,'base64').toString()),'mfa');if(!accounts||typeof accounts!=='object'||Array.isArray(accounts))throw Error('Invalid security records');return {accounts,sha:f.sha}}
 catch(e){if(e.status===404)return {accounts:{},sha:null};throw e}
}
async function writeSecurity(accounts,sha){
 const content=Buffer.from(JSON.stringify(encryptRecord(accounts,'mfa'))+'\n').toString('base64');
 await github(`contents/${FILE}`,{method:'PUT',body:JSON.stringify({branch:BRANCH,message:'Update encrypted two-step verification records [skip ci]',content,...(sha?{sha}:{})})});
}
// Enrollment state is authenticated AND encrypted, and only accepted in a short-lived signed cookie.
function sealEnrollment(secret,account){return encryptRecord({secret,account,expires:Date.now()+600000},'mfa-enrollment')}
function openEnrollment(record,account){const p=decryptRecord(record,'mfa-enrollment');if(p.account!==account||p.expires<Date.now())throw Error('Setup has expired. Sign in again.');return p.secret}
module.exports={base32,totp,matchStep,accountKey,recoveryHash,readSecurity,writeSecurity,sealEnrollment,openEnrollment};

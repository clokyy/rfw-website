const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
process.env.SESSION_SECRET='test-only-security-root';process.env.ADMIN_USERNAME='owner';process.env.ADMIN_PASSWORD='test-only-owner-password';process.env.GITHUB_TOKEN='test-only';
const lib=require('../netlify/functions/_lib.cjs'),crypt=require('../netlify/functions/lib/crypto.cjs'),totp=require('../netlify/functions/lib/mfa.cjs');
const handlers=Object.fromEntries(['admin-auth','admin-mfa','admin-data','admin-users','admin-media','admin-password'].map(n=>[n,require('../netlify/functions/'+n+'.cjs').handler]));
const storage=require('./fixtures/admin-storage.cjs')({products:[]}),security=storage.security;
const user={id:'environment-owner',username:'owner'};
const event=(method='GET',cookie='',body={},headers={})=>({httpMethod:method,headers:{host:'site.example','content-type':'application/json',cookie,...headers},body:JSON.stringify(body)});
const call=async(name,method,cookie,body,headers)=>{const r=await handlers[name](event(method,cookie,body,headers));return {status:r.statusCode,data:JSON.parse(r.body),headers:r.headers,cookie:r.headers['Set-Cookie']?.split(';')[0]}};
const login=()=>call('admin-auth','POST','',{username:'owner',password:process.env.ADMIN_PASSWORD});
function legacy(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(),iv),data=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);return {version:1,iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:data.toString('base64')}}
(async()=>{
 // RFC 6238 SHA1 vectors, truncated to the app's six digits.
 const reference=totp.base32(Buffer.from('12345678901234567890'));
 for(const [time,code] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']])assert.equal(totp.totp(reference,Math.floor(time/30)),code);
 assert.equal(totp.matchStep(reference,'287082',-1,59000),1);assert.equal(totp.matchStep(reference,'287082',1,59000),null);assert.equal(totp.matchStep(reference,'abc',-1,59000),null);
 // Backward compatible legacy decryption, purpose-separated authenticated encryption and signing.
 const sample={private:'test-only-sensitive-data'};assert.deepEqual(crypt.decryptRecord(legacy(sample),'invoices'),sample);
 const encrypted=crypt.encryptRecord(sample,'invoices');assert.equal(encrypted.version,2);assert.deepEqual(crypt.decryptRecord(encrypted,'invoices'),sample);assert.throws(()=>crypt.decryptRecord(encrypted,'administrators'));assert(!JSON.stringify(encrypted).includes(sample.private));
 const tampered={...encrypted,tag:Buffer.alloc(16).toString('base64')};assert.throws(()=>crypt.decryptRecord(tampered,'invoices'));
 process.env.DATA_ENCRYPTION_KEY='test-only-independent-data-key-for-security-tests';const independent=crypt.encryptRecord(sample,'invoices');assert.equal(independent.keyId,'data-key');assert.deepEqual(crypt.decryptRecord(encrypted,'invoices'),sample);
 const oldRoot=process.env.SESSION_SECRET;process.env.LEGACY_ENCRYPTION_SECRET=oldRoot;process.env.SESSION_SECRET='test-only-rotated-session-root';assert.deepEqual(crypt.decryptRecord(independent,'invoices'),sample);assert.deepEqual(crypt.decryptRecord(legacyWithRoot(oldRoot,sample),'invoices'),sample);process.env.SESSION_SECRET=oldRoot;delete process.env.LEGACY_ENCRYPTION_SECRET;delete process.env.DATA_ENCRYPTION_KEY;
 const oldData=Buffer.from(JSON.stringify({u:'owner',exp:Date.now()+60000})).toString('base64url'),oldSignature=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(oldData).digest('base64url');assert.equal(lib.getSession(event('GET',`rfw_admin=${oldData}.${oldSignature}`),{allowMfa:true}),null);
 // Browser cross-origin/CSRF checks, even if an attacker supplies a valid cookie.
 const full=security.cookie();for(const headers of [{origin:'https://evil.example'},{origin:'null'},{'sec-fetch-site':'cross-site'}])assert.equal((await call('admin-auth','POST','',{username:'owner',password:process.env.ADMIN_PASSWORD},headers)).status,403);
 assert.equal((await call('admin-users','POST',full,{}, {'content-type':'text/plain'})).status,403);assert.equal((await call('admin-users','GET',full,{}, {origin:'https://site.example'})).status,200);
 // Old cookies cannot access protected APIs or bypass MFA.
 const oldCookie='rfw_admin='+lib.sign({u:'owner',id:user.id,pv:lib.ownerPasswordVersion(),exp:Date.now()+60000});assert.equal((await call('admin-data','GET',oldCookie)).data.code,'MFA_REQUIRED');assert.equal((await call('admin-mfa','GET',oldCookie)).status,200);
 security.remove();let pending=await login();assert(pending.data.mfaRequired);assert(!pending.data.mustChangePassword);assert.equal((await call('admin-data','GET',pending.cookie)).status,403);
 let setup=await call('admin-mfa','POST',pending.cookie,{action:'begin'});assert.equal(setup.status,200);assert.match(setup.data.secret,/^[A-Z2-7]{32}$/);const payload=JSON.parse(Buffer.from(setup.cookie.split('=')[1].split('.')[0],'base64url'));assert(!JSON.stringify(payload).includes(setup.data.secret));assert.equal(payload.mfa,false);assert.equal((await call('admin-mfa','POST',pending.cookie,{code:totp.totp(setup.data.secret)})).status,400);
 const verificationCode=totp.totp(setup.data.secret);security.failWrite=503;const failed=await call('admin-mfa','POST',setup.cookie,{code:verificationCode});assert.equal(failed.status,503);assert.equal(failed.cookie,undefined);security.failWrite=0;
 let enrolled=await call('admin-mfa','POST',setup.cookie,{code:verificationCode});assert.equal(enrolled.status,200);assert.equal(enrolled.data.recoveryCodes.length,10);assert.equal(new Set(enrolled.data.recoveryCodes).size,10);assert.match(enrolled.headers['Set-Cookie'],/Max-Age=28800/);assert.equal((await call('admin-data','GET',enrolled.cookie)).status,200);assert.equal((await call('admin-mfa','POST',pending.cookie,{action:'begin'})).status,409);
 const persisted=security.record();assert(!JSON.stringify(persisted).includes(enrolled.data.recoveryCodes[0]));assert.equal(persisted.lastStep,Math.floor(Date.now()/30000));
 // Fresh password login still needs MFA; no access is granted for replayed codes.
 pending=await login();assert.equal((await call('admin-mfa','POST',pending.cookie,{code:verificationCode})).status,401);
 const recovery=enrolled.data.recoveryCodes[0],recovered=await call('admin-mfa','POST',pending.cookie,{code:recovery});assert.equal(recovered.status,200);assert.equal(security.record().recovery.length,9);assert.equal((await call('admin-mfa','POST',pending.cookie,{code:recovery})).status,401);
 // Persistent per-account cooldown survives distinct requests and can be recovered with a one-time backup code.
 security.seed(user,{...security.record(),failedAttempts:0,failedAt:0,lastStep:Math.floor(Date.now()/30000)+2});
 for(let i=0;i<5;i++)assert.equal((await call('admin-mfa','POST',pending.cookie,{code:'invalid'})).status,401);
 const locked=await call('admin-mfa','POST',pending.cookie,{code:'invalid'});assert.equal(locked.status,429);assert(+locked.headers['Retry-After']>0);assert.equal((await call('admin-mfa','POST',pending.cookie,{code:enrolled.data.recoveryCodes[1]})).status,200);assert.equal(security.record().lockedUntil,0);
 // Fail closed for storage outages, stale security versions, password rotation, CAS conflicts, expired enrollment and cookie tampering.
 security.failRead=503;assert.equal((await call('admin-data','GET',recovered.cookie)).status,503);security.failRead=0;
 security.seed(user,{...security.record(),version:'changed'});assert.equal((await call('admin-data','GET',recovered.cookie)).status,401);
 const savedPassword=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='different-test-password';assert.equal((await call('admin-mfa','GET',pending.cookie)).status,401);process.env.ADMIN_PASSWORD=savedPassword;
 const before=security.record().recovery.length;security.beforeWrite=()=>security.seed(user,security.record());const conflict=await call('admin-mfa','POST',pending.cookie,{code:enrolled.data.recoveryCodes[2]});assert.equal(conflict.status,409);assert.equal(conflict.cookie,undefined);assert.equal(security.record().recovery.length,before);
 const altered=setup.cookie.slice(0,-1)+(setup.cookie.endsWith('a')?'b':'a');assert.equal((await call('admin-mfa','POST',altered,{code:'123456'})).status,401);
 // Upload decoder verifies declared format, strips metadata/payload, limits pixels and converts to static WebP.
 const sharp=require('sharp'),sanitize=require('../netlify/functions/admin-media.cjs')._test.sanitizeImage;
 const png=await sharp({create:{width:4,height:4,channels:4,background:'#123456'}}).png().toBuffer();const uploaded=await sanitize({mimeType:'image/png',data:Buffer.concat([png,Buffer.from('<script>test payload</script>')]).toString('base64')});assert.equal((await sharp(uploaded).metadata()).format,'webp');assert(!uploaded.toString().includes('test payload'));
 for(const input of [{mimeType:'image/png',data:Buffer.from('<svg></svg>').toString('base64')},{mimeType:'image/jpeg',data:png.toString('base64')},{mimeType:'image/svg+xml',data:png.toString('base64')},{mimeType:'image/png',data:'!!!!'},{mimeType:'image/png',data:png.subarray(0,20).toString('base64')}])await assert.rejects(()=>sanitize(input));
 const large=await sharp(crypto.randomBytes(700*700*3),{raw:{width:700,height:700,channels:3}}).png().toBuffer();assert(large.length>1000000);assert((await sanitize({mimeType:'image/png',data:large.toString('base64')})).length>0);
 const huge=await sharp({create:{width:5000,height:5000,channels:3,background:'#000000'}}).png().toBuffer();await assert.rejects(()=>sanitize({mimeType:'image/png',data:huge.toString('base64')}));
 // Production output is an allowlist, not the repository root.
 require('../scripts/build.cjs');assert(fs.existsSync(path.join(__dirname,'../public/data/site.json')));for(const name of ['data/admin-users.enc.json','data/security.enc.json','data/invoices','netlify','tests','scripts','package.json','README.md'])assert(!fs.existsSync(path.join(__dirname,'../public',name)),name+' must not be published');
 console.log('Security tests passed: RFC TOTP, legacy/new encryption, CSRF, mandatory MFA, enrollment, recovery, replay prevention, persistent cooldown, conflicts, revocation, upload validation and private-file exclusion');
})().catch(e=>{console.error(e);process.exitCode=1});
function legacyWithRoot(secret,value){const previous=process.env.SESSION_SECRET;process.env.SESSION_SECRET=secret;const record=legacy(value);process.env.SESSION_SECRET=previous;return record}

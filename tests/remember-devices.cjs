const assert=require('node:assert/strict');
process.env.SESSION_SECRET='test-only-remembered-browser-root';process.env.ADMIN_USERNAME='owner';process.env.ADMIN_PASSWORD='test-only-owner-password';process.env.GITHUB_TOKEN='test-only';
const lib=require('../netlify/functions/_lib.cjs'),mfaLib=require('../netlify/functions/lib/mfa.cjs'),devices=require('../netlify/functions/lib/devices.cjs');
const handlers=Object.fromEntries(['admin-auth','admin-mfa','admin-data'].map(n=>[n,require('../netlify/functions/'+n+'.cjs').handler]));
const storage=require('./fixtures/admin-storage.cjs')({products:[]}),security=storage.security,owner={username:'owner',id:'environment-owner'};
const cookies=r=>[...(r.headers?.['Set-Cookie']?[r.headers['Set-Cookie']]:[]),...(r.multiValueHeaders?.['Set-Cookie']||[])];
const pair=(r,name)=>cookies(r).find(v=>v.startsWith(name+'='))?.split(';')[0];
const event=(method,cookie,body={},headers={})=>({httpMethod:method,headers:{host:'staff.example','content-type':'application/json',cookie:cookie||'',...headers},body:JSON.stringify(body)});
const call=async(name,method,cookie,body,headers)=>{const r=await handlers[name](event(method,cookie,body,headers));return {...r,status:r.statusCode,data:JSON.parse(r.body)}};
const login=(trust='',username='owner',password=process.env.ADMIN_PASSWORD)=>call('admin-auth','POST',trust,{username,password});
const pending=async(user=owner,password)=>pair(await login('',user.username,password),'rfw_admin');
const reset=(user=owner,extra={})=>security.seed(user,{devices:[],lastStep:-1,...extra});
async function verify(cookie,rememberDevice=true,user=owner,extra={}){return call('admin-mfa','POST',cookie,{code:mfaLib.totp(security.record(user).secret),rememberDevice,...extra})}
const active=cookie=>call('admin-data','GET',cookie);
const now=Date.now;let clock=now();Date.now=()=>clock;
(async()=>{
 // Opt in only after successful MFA; password-only and failed MFA cannot mint trust.
 reset();let pass=await pending();let bad=await call('admin-mfa','POST',pass,{code:'invalid',rememberDevice:true});assert.equal(bad.status,401);assert.equal(pair(bad,devices.COOKIE),undefined);assert.equal(security.record().devices.length,0);
 let unchecked=await verify(pass,false);assert.equal(unchecked.status,200);assert.equal(pair(unchecked,devices.COOKIE),undefined);assert.equal(security.record().devices.length,0);
 reset();pass=await pending();let strict=await verify(pass,'true');assert.equal(strict.status,200);assert.equal(pair(strict,devices.COOKIE),undefined);
 // First-time enrollment can also opt in. No raw bearer secret is stored or returned in JSON.
 security.remove();pass=await pending();const setup=await call('admin-mfa','POST',pass,{action:'begin'});
 const enrolled=await call('admin-mfa','POST',pair(setup,'rfw_admin'),{code:mfaLib.totp(setup.data.secret),rememberDevice:true});assert.equal(enrolled.status,200);assert.equal(enrolled.data.recoveryCodes.length,10);assert(pair(enrolled,devices.COOKIE));
 reset();pass=await pending();let verified=await verify(pass);assert.equal(verified.status,200);const direct=pair(verified,'rfw_admin'),original=pair(verified,devices.COOKIE),originalRecord=security.record().devices[0];
 assert.match(cookies(verified).find(v=>v.startsWith(devices.COOKIE)),/HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=2592000/);assert(!cookies(verified).some(v=>/Domain=/i.test(v)));assert.equal(cookies(verified).length,2);assert.equal(verified.headers['Set-Cookie'],undefined);assert(verified.multiValueHeaders);
 const secret=original.split('.')[1];assert(!JSON.stringify(security.record()).includes(secret));assert(!JSON.stringify(verified.data).includes(secret));assert.equal(originalRecord.expiresAt-originalRecord.createdAt,devices.DURATION);assert.equal((await active(direct)).status,200);
 // Logout clears only the eight-hour session. Password remains mandatory on remembered browsers.
 const logout=await call('admin-auth','DELETE',direct+'; '+original);assert.equal(cookies(logout).length,1);assert.match(cookies(logout)[0],/^rfw_admin=;.*Max-Age=0/);
 assert.equal((await login(original,'owner','wrong-password')).status,401);assert.equal((await login()).data.mfaRequired,true);
 clock+=10*86400000;let remembered=await login(original,'OWNER');assert.equal(remembered.status,200);assert.equal(remembered.data.mfaRequired,false);
 let rotated=pair(remembered,devices.COOKIE),trustedSession=pair(remembered,'rfw_admin');assert.notEqual(rotated,original);assert.equal(security.record().devices[0].expiresAt,originalRecord.expiresAt);assert.match(cookies(remembered).find(v=>v.startsWith(devices.COOKIE)),/Max-Age=1728000/);assert.equal((await active(trustedSession)).status,200);
 const payload=lib.getSession(event('GET',trustedSession));assert.equal(payload.td,originalRecord.id);assert(!JSON.stringify(payload).includes(secret));
 const replay=await login(original);assert.equal(replay.data.mfaRequired,true);assert.match(cookies(replay).find(v=>v.startsWith(devices.COOKIE)),/Max-Age=0/);
 for(const trust of [devices.COOKIE+'=malformed',rotated.slice(0,-1)+(rotated.endsWith('a')?'b':'a'),rotated+'; '+rotated])assert.equal((await login(trust)).data.mfaRequired,true);
 // A pending password-only session cannot forget browsers, and CSRF checks remain in force.
 const passwordOnly=await pending();assert.equal((await call('admin-mfa','POST',passwordOnly,{action:'forget-devices'})).status,403);assert.equal(security.record().devices.length,1);
 assert.equal((await call('admin-mfa','POST',trustedSession,{action:'forget-devices'},{origin:'https://evil.example'})).status,403);
 // Failed reads/writes and CAS races never grant full access or emit a trusted cookie.
 security.failRead=503;assert.equal((await login(rotated)).status,503);security.failRead=0;
 security.failWrite=503;const failed=await login(rotated);assert.equal(failed.status,503);assert.equal(cookies(failed).length,0);security.failWrite=0;
 security.beforeWrite=()=>security.seed(owner,security.record());const conflict=await login(rotated);assert.equal(conflict.status,409);assert.equal(cookies(conflict).length,0);
 // Expiry is absolute, also constraining any session established via remembered-browser access.
 clock=originalRecord.expiresAt;assert.equal((await login(rotated)).data.mfaRequired,true);assert.equal((await active(trustedSession)).status,401);clock=now();
 // Explicit forgetting revokes every remembered browser and their derived sessions, not normal MFA sessions.
 reset();pass=await pending();verified=await verify(pass);const mfaSession=pair(verified,'rfw_admin');let token=pair(verified,devices.COOKIE);remembered=await login(token);trustedSession=pair(remembered,'rfw_admin');token=pair(remembered,devices.COOKIE);
 const revoke=await call('admin-mfa','POST',mfaSession,{action:'forget-devices'});assert.equal(revoke.status,200);assert.equal(revoke.data.signInAgain,false);assert.equal(security.record().devices.length,0);assert.match(cookies(revoke)[0],/Max-Age=0/);assert.equal((await login(token)).data.mfaRequired,true);assert.equal((await active(trustedSession)).status,401);assert.equal((await active(mfaSession)).status,200);
 reset();pass=await pending();verified=await verify(pass);remembered=await login(pair(verified,devices.COOKIE));trustedSession=pair(remembered,'rfw_admin');const revokeTrusted=await call('admin-mfa','POST',trustedSession,{action:'forget-devices'});assert.equal(revokeTrusted.data.signInAgain,true);assert.equal(cookies(revokeTrusted).length,2);assert(cookies(revokeTrusted).every(v=>v.includes('Max-Age=0')));assert.equal((await active(trustedSession)).status,401);
 // MFA and owner password/signing-key changes invalidate trust, even when a cookie is still present.
 reset();pass=await pending();verified=await verify(pass);token=pair(verified,devices.COOKIE);security.seed(owner,{...security.record(),version:'new-mfa-version'});assert.equal((await login(token)).data.mfaRequired,true);
 reset();pass=await pending();verified=await verify(pass);token=pair(verified,devices.COOKIE);const oldPassword=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='new-test-only-owner-password';assert.equal((await login(token)).data.mfaRequired,true);process.env.ADMIN_PASSWORD=oldPassword;
 process.env.SESSION_SIGNING_KEY='test-only-new-independent-signing-key';assert.equal((await login(token)).data.mfaRequired,true);delete process.env.SESSION_SIGNING_KEY;
 // Staff tokens bind to the precise account ID, password version and MFA version.
 const h=lib.hashPassword('test-only-staff-password'),staff={id:'staff-id',username:'staff',salt:h.salt,passwordHash:h.hash,passwordVersion:'pv-1',active:true};storage.seed([staff]);reset(staff);pass=await pending(staff,'test-only-staff-password');verified=await verify(pass,true,staff);token=pair(verified,devices.COOKIE);assert.equal((await login(token,'staff','test-only-staff-password')).data.mfaRequired,false);assert.equal((await login(token)).data.mfaRequired,true);
 storage.seed([{...staff,passwordVersion:'pv-2'}]);assert.equal((await login(token,'staff','test-only-staff-password')).data.mfaRequired,true);
 storage.seed([{...staff,mustChangePassword:true}]);assert.equal((await login(token,'staff','test-only-staff-password')).data.mustChangePassword,true);
 storage.seed([{...staff,active:false}]);assert.equal((await login(token,'staff','test-only-staff-password')).status,401);storage.seed([]);assert.equal((await login(token,'staff','test-only-staff-password')).status,401);
 // Opt-out clears the current browser's existing trust after genuine MFA, while retaining ordinary access.
 reset();pass=await pending();verified=await verify(pass);token=pair(verified,devices.COOKIE);reset(owner,{...security.record(),lastStep:-1});pass=await pending();const optedOut=await verify(pass+'; '+token,false);assert.equal(optedOut.status,200);assert.equal(security.record().devices.length,0);assert.match(cookies(optedOut).find(v=>v.startsWith(devices.COOKIE)),/Max-Age=0/);
 // The number of stored device records is bounded. Expired records are pruned.
 reset();const record=security.record();for(let i=0;i<devices.MAX_DEVICES+5;i++)devices.issue(record,owner,'owner',event('POST',''));assert.equal(record.devices.length,10);assert.equal(new Set(record.devices.map(d=>d.id)).size,10);
 devices.issue(record,owner,'owner',event('POST',''),clock+devices.DURATION+1);assert.equal(record.devices.length,1);
 console.log('Remembered devices passed: opt-in MFA, secure cookies, hashed rotating tokens, password requirement, absolute expiry, replay rejection, account binding, revocation, session invalidation, CAS/outages, CSRF and device limits');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{Date.now=now});

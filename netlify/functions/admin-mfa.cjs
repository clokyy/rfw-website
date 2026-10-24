const crypto=require('node:crypto');
const devices=require('./lib/devices.cjs');
const {json,authorize,sessionCookie,safeEqual}=require('./_lib.cjs');
const {base32,matchStep,accountKey,recoveryHash,readSecurity,writeSecurity,sealEnrollment,openEnrollment}=require('./lib/mfa.cjs');
exports.handler=async event=>{
 const auth=await authorize(event,{allowMfa:true});if(auth.denied)return auth.denied;
 if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed'});
 if((event.body||'').length>2000)return json(413,{error:'Verification request is too large'});
 try{
  const file=await readSecurity(),key=accountKey(auth.user),record=file.accounts[key],role=auth.owner?'owner':'admin';
  if(event.httpMethod==='GET')return json(200,{enrolled:!!record});
  const input=JSON.parse(event.body||'{}');
  if(input.action==='forget-devices'){
   if(auth.session.mfa!==true||!record||record.version!==auth.session.mv||!devices.sessionValid(auth.session,auth.user,role,record))return json(403,{error:'Complete two-step verification before managing remembered browsers'});
   record.devices=[];await writeSecurity(file.accounts,file.sha);
   const response=json(200,{ok:true,signInAgain:!!auth.session.td});
   const cookies=[devices.clearCookie()];
   if(auth.session.td)cookies.push('rfw_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
   return devices.withCookies(response,...cookies);
  }
  if(input.action==='begin'){
   if(record)return json(409,{error:'Two-step verification is already set up. Enter your code.'});
   const secret=base32(crypto.randomBytes(20)),enrollment=sealEnrollment(secret,key);
   return json(200,{secret,uri:`otpauth://totp/${encodeURIComponent('Regina Fireworks:'+auth.user.username)}?secret=${secret}&issuer=Regina%20Fireworks&algorithm=SHA1&digits=6&period=30`},{'Set-Cookie':sessionCookie(auth.user,role,{enrollment})});
  }
  const code=String(input.code||'').trim();let recoveryCodes;
  if(!record){
   if(!auth.session.enrollment)return json(400,{error:'Start authenticator setup first'});
   const secret=openEnrollment(auth.session.enrollment,key),step=matchStep(secret,code);
   if(step===null)return json(401,{error:'Invalid verification code. Check the code and your device time.'});
   recoveryCodes=Array.from({length:10},()=>crypto.randomBytes(10).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
   file.accounts[key]={secret,lastStep:step,recovery:recoveryCodes.map(recoveryHash),version:crypto.randomUUID(),createdAt:new Date().toISOString()};
  }else{
   const index=(record.recovery||[]).findIndex(hash=>safeEqual(hash,recoveryHash(code)));
   if(index<0&&record.lockedUntil>Date.now())return json(429,{error:'Too many verification attempts. Wait 15 minutes or use an unused recovery code.'},{'Retry-After':String(Math.ceil((record.lockedUntil-Date.now())/1000))});
   const step=matchStep(record.secret,code,record.lastStep);
   if(step===null&&index<0){
    if(!record.failedAt||Date.now()-record.failedAt>900000){record.failedAt=Date.now();record.failedAttempts=0}
    record.failedAttempts=(record.failedAttempts||0)+1;
    if(record.failedAttempts>=5){record.lockedUntil=Date.now()+900000;record.failedAttempts=0;record.failedAt=Date.now()}
    await writeSecurity(file.accounts,file.sha);
    return json(401,{error:'Invalid or already used verification code. Use a new code or a recovery code.'});
   }
   record.failedAttempts=0;record.failedAt=0;record.lockedUntil=0;
   if(index>=0)record.recovery.splice(index,1);else record.lastStep=step;
  }
  const account=file.accounts[key];let trusted;
  if(input.rememberDevice===true)trusted=devices.issue(account,auth.user,role,event);
  else devices.forgetCurrent(account,event);
  // Conditional GitHub SHA write must succeed before any full-access cookie is issued.
  await writeSecurity(file.accounts,file.sha);
  const response=json(200,{ok:true,...(recoveryCodes?{recoveryCodes}:{})},{'Set-Cookie':sessionCookie(auth.user,role,{mfa:true,mv:file.accounts[key].version})});
  if(trusted)return devices.withCookies(response,trusted.cookie);
  return devices.hasCookie(event)?devices.withCookies(response,devices.clearCookie()):response;
 }catch(e){return json(e.status===409?409:503,{error:e.status===409?'Verification records changed. Wait for a new code and try again.':'Unable to complete verification. Try again or sign in again.'})}
};

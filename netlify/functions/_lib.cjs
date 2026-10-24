const crypto=require('crypto');
const {signingKey,encryptRecord,decryptRecord}=require('./lib/crypto.cjs');
const {checkWrite}=require('./lib/request.cjs');
const OWNER=process.env.GITHUB_OWNER||'clokyy',REPO=process.env.GITHUB_REPO||'rfw-website',BRANCH=process.env.GITHUB_BRANCH||'main';
const json=(statusCode,body,headers={})=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Strict-Transport-Security':'max-age=31536000','Permissions-Policy':'camera=(self), microphone=(), geolocation=(), payment=()','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...headers},body:JSON.stringify(body)});
const safeEqual=(a,b)=>crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(),crypto.createHash('sha256').update(String(b)).digest());
const hashPassword=(password,salt=crypto.randomBytes(16).toString('hex'))=>({salt,hash:crypto.scryptSync(String(password),salt,64).toString('hex')});
const verifyPassword=(password,user)=>{try{return safeEqual(hashPassword(password,user.salt).hash,user.passwordHash)}catch{return false}};
function sign(payload){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',signingKey()).update(data).digest('base64url');return `${data}.${sig}`}
function getSession(event,{allowPasswordChange=false,allowMfa=false}={}){try{const cookie=(event.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rfw_admin='));if(!cookie||!process.env.SESSION_SECRET)return null;const token=cookie.slice(10);if(token.length>6000||token.split('.').length!==2)return null;const [data,sig]=token.split('.');const expected=crypto.createHmac('sha256',signingKey()).update(data).digest('base64url');if(!safeEqual(sig,expected))return null;const p=JSON.parse(Buffer.from(data,'base64url'));return p.u&&Number.isFinite(p.exp)&&p.exp>Date.now()&&(!p.mustChangePassword||allowPasswordChange)&&(p.mfa===true||allowMfa)?p:null}catch{return null}}
const verify=event=>!!getSession(event);
async function requireAuth(event){return (await authorize(event)).denied||null}
function ownerPasswordVersion(){return crypto.createHmac('sha256',signingKey()).update('owner-password:'+String(process.env.ADMIN_PASSWORD||'')).digest('base64url')}
function sessionCookie(user,role='admin',extra={}){
 const pending=user.mustChangePassword===true||extra.mfa!==true,seconds=pending?600:28800;
 const token=sign({u:user.username,id:user.id,role,pv:role==='owner'?ownerPasswordVersion():user.passwordVersion||'',mustChangePassword:user.mustChangePassword===true,mfa:false,exp:Date.now()+seconds*1000,...extra});
 return `rfw_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${seconds}`;
}
async function authorize(event,{allowPasswordChange=false,allowMfa=false}={}){
 const rejected=checkWrite(event);if(rejected)return {denied:json(403,{error:rejected})};
 const session=getSession(event,{allowPasswordChange:true,allowMfa:true});if(!session)return {denied:json(401,{error:'Authentication required'})};
 const owner=String(process.env.ADMIN_USERNAME||'').trim().toLowerCase();
 if(owner&&session.u===owner){
  if(session.id!=='environment-owner'||session.pv!==ownerPasswordVersion())return {denied:json(401,{error:'Please sign in again'})};
  const result={session,user:{username:owner,id:'environment-owner',firstName:process.env.ADMIN_FIRST_NAME,lastName:process.env.ADMIN_LAST_NAME},owner:true};
  try{return allowMfa?result:await requireMfa(result)}catch{return {denied:json(503,{error:'Security storage is temporarily unavailable'})}};
 }
 try{
  const file=await readAdminFile(),user=file.users.find(u=>u.username===session.u&&u.id===session.id&&u.active!==false);
  if(!user||(session.pv||'')!==(user.passwordVersion||''))return {denied:json(401,{error:'This administrator session is no longer active. Please sign in again.'})};
  if((user.mustChangePassword===true||session.mustChangePassword)&&!allowPasswordChange)return {denied:json(403,{error:'Change your temporary password before accessing the staff panel',code:'PASSWORD_CHANGE_REQUIRED'})};
  const result={session,user,users:file.users,sha:file.sha,owner:false};return allowMfa?result:await requireMfa(result);
 }catch{return {denied:json(503,{error:'Administrator storage is temporarily unavailable. Please try again.'})}}
}
const ADMIN_FILE='data/admin-users.enc.json';
async function requireMfa(auth){
 if(auth.session.mfa!==true)return {denied:json(403,{error:'Complete two-step verification before accessing the staff panel',code:'MFA_REQUIRED'})};
 const {readSecurity,accountKey}=require('./lib/mfa.cjs');
 const security=await readSecurity(),record=security.accounts[accountKey(auth.user)];
 if(!record||record.version!==auth.session.mv)return {denied:json(401,{error:'Two-step verification has changed. Please sign in again.'})};
 return auth;
}
function encryptAdmins(users){return encryptRecord(users,'administrators')}
function decryptAdmins(record){return decryptRecord(record,'administrators')}
async function readAdminFile(){try{const file=await github(`contents/${ADMIN_FILE}?ref=${encodeURIComponent(BRANCH)}`),record=JSON.parse(Buffer.from(file.content,'base64').toString()),users=decryptAdmins(record);return {users:Array.isArray(users)?users:[],sha:file.sha}}catch(e){if(e.status===404)return {users:[],sha:null};throw e}}
async function readAdmins(){return (await readAdminFile()).users}
async function writeAdmins(users,sha){if(sha===undefined)sha=(await readAdminFile()).sha;const record=encryptAdmins(users),body={message:'Update encrypted administrator accounts [skip ci]',content:Buffer.from(JSON.stringify(record,null,2)+'\n').toString('base64'),branch:BRANCH,...(sha?{sha}:{})};await github(`contents/${ADMIN_FILE}`,{method:'PUT',body:JSON.stringify(body)})}
async function github(path,options={}){if(!process.env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN is not configured');const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(options.headers||{})}});const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={message:text}}if(!r.ok){const error=new Error(body.message||`GitHub request failed (${r.status})`);error.status=r.status;throw error}return body}
module.exports={json,safeEqual,hashPassword,verifyPassword,sign,getSession,verify,requireAuth,authorize,sessionCookie,readAdmins,readAdminFile,writeAdmins,github,OWNER,REPO,BRANCH,ownerPasswordVersion};

// This legacy shared-module filename must never act as a public API.
module.exports.handler=async()=>json(404,{error:'Not found'});

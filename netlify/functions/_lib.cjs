const crypto=require('crypto');
const OWNER=process.env.GITHUB_OWNER||'clokyy',REPO=process.env.GITHUB_REPO||'rfw-website',BRANCH=process.env.GITHUB_BRANCH||'main';
const json=(statusCode,body,headers={})=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers},body:JSON.stringify(body)});
const safeEqual=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const hashPassword=(password,salt=crypto.randomBytes(16).toString('hex'))=>({salt,hash:crypto.scryptSync(String(password),salt,64).toString('hex')});
const verifyPassword=(password,user)=>{try{return safeEqual(hashPassword(password,user.salt).hash,user.passwordHash)}catch{return false}};
function sign(payload){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(data).digest('base64url');return `${data}.${sig}`}
function getSession(event,{allowPasswordChange=false}={}){try{const cookie=(event.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rfw_admin='));if(!cookie||!process.env.SESSION_SECRET)return null;const token=cookie.slice(10),[data,sig]=token.split('.');const expected=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(data).digest('base64url');if(!safeEqual(sig,expected))return null;const p=JSON.parse(Buffer.from(data,'base64url'));return p.u&&p.exp>Date.now()&&(!p.mustChangePassword||allowPasswordChange)?p:null}catch{return null}}
const verify=event=>!!getSession(event);
async function requireAuth(event){return (await authorize(event)).denied||null}
function sessionCookie(user,role='admin'){const pending=user.mustChangePassword===true,seconds=pending?1800:28800;const token=sign({u:user.username,id:user.id,role,pv:user.passwordVersion||'',mustChangePassword:pending,exp:Date.now()+seconds*1000});return `rfw_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${seconds}`}
async function authorize(event,{allowPasswordChange=false}={}){
 const session=getSession(event,{allowPasswordChange:true});if(!session)return {denied:json(401,{error:'Authentication required'})};
 const owner=String(process.env.ADMIN_USERNAME||'').trim().toLowerCase();
 if(owner&&session.u===owner)return {session,user:{username:owner,id:'environment-owner',firstName:process.env.ADMIN_FIRST_NAME,lastName:process.env.ADMIN_LAST_NAME},owner:true};
 try{
  const file=await readAdminFile(),user=file.users.find(u=>u.username===session.u&&u.id===session.id&&u.active!==false);
  if(!user||(session.pv||'')!==(user.passwordVersion||''))return {denied:json(401,{error:'This administrator session is no longer active. Please sign in again.'})};
  if((user.mustChangePassword===true||session.mustChangePassword)&&!allowPasswordChange)return {denied:json(403,{error:'Change your temporary password before accessing the staff panel',code:'PASSWORD_CHANGE_REQUIRED'})};
  return {session,user,users:file.users,sha:file.sha,owner:false};
 }catch{return {denied:json(503,{error:'Administrator storage is temporarily unavailable. Please try again.'})}}
}
const ADMIN_FILE='data/admin-users.enc.json';
function adminKey(){const secret=process.env.SESSION_SECRET;if(!secret)throw new Error('SESSION_SECRET is not configured');return crypto.createHash('sha256').update(secret).digest()}
function encryptAdmins(users){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',adminKey(),iv),data=Buffer.concat([cipher.update(JSON.stringify(users),'utf8'),cipher.final()]);return {version:1,algorithm:'aes-256-gcm',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}}
function decryptAdmins(record){if(Array.isArray(record))return record;if(record&&record.version===0&&Array.isArray(record.users))return record.users;if(!record||record.version!==1)throw new Error('Unsupported administrator data format');const decipher=crypto.createDecipheriv('aes-256-gcm',adminKey(),Buffer.from(record.iv,'base64'));decipher.setAuthTag(Buffer.from(record.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.data,'base64')),decipher.final()]).toString('utf8'))}
async function readAdminFile(){try{const file=await github(`contents/${ADMIN_FILE}?ref=${encodeURIComponent(BRANCH)}`),record=JSON.parse(Buffer.from(file.content,'base64').toString()),users=decryptAdmins(record);return {users:Array.isArray(users)?users:[],sha:file.sha}}catch(e){if(e.status===404)return {users:[],sha:null};throw e}}
async function readAdmins(){return (await readAdminFile()).users}
async function writeAdmins(users,sha){if(sha===undefined)sha=(await readAdminFile()).sha;const record=encryptAdmins(users),body={message:'Update encrypted administrator accounts [skip ci]',content:Buffer.from(JSON.stringify(record,null,2)+'\n').toString('base64'),branch:BRANCH,...(sha?{sha}:{})};await github(`contents/${ADMIN_FILE}`,{method:'PUT',body:JSON.stringify(body)})}
async function github(path,options={}){if(!process.env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN is not configured');const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(options.headers||{})}});const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={message:text}}if(!r.ok){const error=new Error(body.message||`GitHub request failed (${r.status})`);error.status=r.status;throw error}return body}
module.exports={json,safeEqual,hashPassword,verifyPassword,sign,getSession,verify,requireAuth,authorize,sessionCookie,readAdmins,readAdminFile,writeAdmins,github,OWNER,REPO,BRANCH};

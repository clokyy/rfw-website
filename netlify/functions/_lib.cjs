const crypto=require('crypto');
const OWNER=process.env.GITHUB_OWNER||'clokyy',REPO=process.env.GITHUB_REPO||'rfw-website',BRANCH=process.env.GITHUB_BRANCH||'main';
const json=(statusCode,body,headers={})=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers},body:JSON.stringify(body)});
const safeEqual=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const hashPassword=(password,salt=crypto.randomBytes(16).toString('hex'))=>({salt,hash:crypto.scryptSync(String(password),salt,64).toString('hex')});
const verifyPassword=(password,user)=>{try{return safeEqual(hashPassword(password,user.salt).hash,user.passwordHash)}catch{return false}};
function sign(payload){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(data).digest('base64url');return `${data}.${sig}`}
function getSession(event){try{const cookie=(event.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rfw_admin='));if(!cookie||!process.env.SESSION_SECRET)return null;const token=cookie.slice(10),[data,sig]=token.split('.');const expected=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(data).digest('base64url');if(!safeEqual(sig,expected))return null;const p=JSON.parse(Buffer.from(data,'base64url'));return p.u&&p.exp>Date.now()?p:null}catch{return null}}
const verify=event=>!!getSession(event);
function requireAuth(event){return verify(event)?null:json(401,{error:'Authentication required'})}
async function adminStore(){const {getStore}=await import('@netlify/blobs');return getStore('rfw-admin-users')}
async function readAdmins(){const store=await adminStore();return (await store.get('users',{type:'json',consistency:'strong'}))||[]}
async function writeAdmins(users){const store=await adminStore();await store.setJSON('users',users)}
async function github(path,options={}){if(!process.env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN is not configured');const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...(options.headers||{})}});const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={message:text}}if(!r.ok)throw new Error(body.message||`GitHub request failed (${r.status})`);return body}
module.exports={json,safeEqual,hashPassword,verifyPassword,sign,getSession,verify,requireAuth,readAdmins,writeAdmins,github,OWNER,REPO,BRANCH};

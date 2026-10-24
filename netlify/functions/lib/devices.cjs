const crypto=require('node:crypto');
const {signingKey}=require('./crypto.cjs');
const {safeEqual,ownerPasswordVersion}=require('../_lib.cjs');
const {accountKey}=require('./mfa.cjs');
const COOKIE='__Host-rfw_trusted',DURATION=30*24*60*60*1000,MAX_DEVICES=10;
const hash=secret=>crypto.createHash('sha256').update('rfw-device-token:'+secret).digest('hex');
function binding(user,role,record){
 const pv=role==='owner'?ownerPasswordVersion():user.passwordVersion||'';
 return crypto.createHmac('sha256',signingKey()).update('remembered-browser\0'+accountKey(user)+'\0'+pv+'\0'+record.version).digest('hex');
}
function readToken(event){
 const values=String(event.headers?.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(COOKIE+'='));
 if(values.length!==1)return null;const value=values[0].slice(COOKIE.length+1);
 if(!/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(value))return null;
 const [id,secret]=value.split('.');return {id,secret};
}
const hasCookie=event=>String(event.headers?.cookie||'').split(';').some(v=>v.trim().startsWith(COOKIE+'='));
const clearCookie=()=>`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
function cookie(token,expiresAt,now=Date.now()){
 return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.max(0,Math.floor((expiresAt-now)/1000))}; Expires=${new Date(expiresAt).toUTCString()}`;
}
function isValid(device,user,role,record,now=Date.now()){
 return !!device&&Number.isFinite(device.createdAt)&&device.createdAt<=now&&Number.isFinite(device.expiresAt)&&device.expiresAt===device.createdAt+DURATION&&device.expiresAt>now&&safeEqual(device.binding,binding(user,role,record));
}
function prune(record,user,role,now=Date.now()){
 record.devices=(Array.isArray(record.devices)?record.devices:[]).filter(d=>isValid(d,user,role,record,now));
 return record.devices;
}
function issue(record,user,role,event,now=Date.now()){
 const current=readToken(event),devices=prune(record,user,role,now).filter(d=>d.id!==current?.id);
 devices.sort((a,b)=>(b.lastUsedAt||b.createdAt)-(a.lastUsedAt||a.createdAt));
 const id=crypto.randomBytes(16).toString('base64url'),secret=crypto.randomBytes(32).toString('base64url');
 const device={id,tokenHash:hash(secret),binding:binding(user,role,record),createdAt:now,lastUsedAt:now,expiresAt:now+DURATION};
 record.devices=[...devices.slice(0,MAX_DEVICES-1),device];
 return {cookie:cookie(`${id}.${secret}`,device.expiresAt,now),id};
}
function consume(record,user,role,event,now=Date.now()){
 const token=readToken(event);if(!record||!token)return null;
 const device=(Array.isArray(record.devices)?record.devices:[]).find(d=>d.id===token.id);
 if(!isValid(device,user,role,record,now)||!safeEqual(device.tokenHash,hash(token.secret)))return null;
 // Rotate the bearer secret at every password login; never extend the original 30-day deadline.
 const secret=crypto.randomBytes(32).toString('base64url');device.tokenHash=hash(secret);device.lastUsedAt=now;
 prune(record,user,role,now);
 return {cookie:cookie(`${device.id}.${secret}`,device.expiresAt,now),id:device.id};
}
function forgetCurrent(record,event){const token=readToken(event);if(record&&Array.isArray(record.devices)&&token)record.devices=record.devices.filter(d=>d.id!==token.id)}
function sessionValid(session,user,role,record,now=Date.now()){
 return !session.td||isValid((record.devices||[]).find(d=>d.id===session.td),user,role,record,now);
}
// AWS Lambda / Netlify v1 requires multiValueHeaders for multiple independent Set-Cookie values.
function withCookies(response,...extra){
 if(!extra.length)return response;
 const cookies=[...(response.headers['Set-Cookie']?[response.headers['Set-Cookie']]:[]),...(response.multiValueHeaders?.['Set-Cookie']||[]),...extra];
 delete response.headers['Set-Cookie'];response.multiValueHeaders={...response.multiValueHeaders,'Set-Cookie':cookies};return response;
}
module.exports={COOKIE,DURATION,MAX_DEVICES,binding,readToken,hasCookie,clearCookie,issue,consume,forgetCurrent,sessionValid,withCookies};

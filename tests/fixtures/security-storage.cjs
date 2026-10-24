// Test-only conditional GitHub storage for MFA records; never contacts a real service.
const assert=require('node:assert/strict');
const {encryptRecord,decryptRecord}=require('../../netlify/functions/lib/crypto.cjs');
const {accountKey}=require('../../netlify/functions/lib/mfa.cjs');
const lib=require('../../netlify/functions/_lib.cjs');
module.exports=()=>{
 const previous=global.fetch;let accounts={},sha=null,version=0;
 const state={failRead:0,failWrite:0,beforeWrite:null,writes:0};
 const owner=()=>({id:'environment-owner',username:process.env.ADMIN_USERNAME||'owner'});
 state.seed=(user=owner(),extra={})=>{accounts[accountKey(user)]={secret:'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',lastStep:-1,recovery:[],version:'test-mfa-'+user.id,...extra};sha=`security-${++version}`;return accounts[accountKey(user)]};
 state.remove=(user=owner())=>{delete accounts[accountKey(user)];sha=`security-${++version}`};
 state.record=(user=owner())=>structuredClone(accounts[accountKey(user)]);
 state.cookie=(user=owner())=>{if(!accounts[accountKey(user)])state.seed(user);return lib.sessionCookie(user,user.id==='environment-owner'?'owner':'admin',{mfa:true,mv:accounts[accountKey(user)].version}).split(';')[0]};
 state.seed();
 global.fetch=async(url,options={})=>{
  if(new URL(url).pathname.split('/contents/')[1]!=='data/security.enc.json')return previous(url,options);
  let status=200,body;
  if(options.method==='PUT'){
   state.writes++;const input=JSON.parse(options.body);if(state.beforeWrite){const fn=state.beforeWrite;state.beforeWrite=null;fn()}
   if(state.failWrite){status=state.failWrite;body={message:'Test security storage unavailable'}}
   else if(input.sha!==sha&&!(input.sha===undefined&&sha===null)){status=409;body={message:'Conflict'}}
   else{const record=JSON.parse(Buffer.from(input.content,'base64').toString());assert.equal(record.version,2);accounts=decryptRecord(record,'mfa');sha=`security-${++version}`;body={content:{sha}}}
  }else if(state.failRead){status=state.failRead;body={message:'Test security storage unavailable'}}
  else if(sha)body={sha,content:Buffer.from(JSON.stringify(encryptRecord(accounts,'mfa'))).toString('base64')};else{status=404;body={message:'Not found'}}
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};
 };
 return state;
};

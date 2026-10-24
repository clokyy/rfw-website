// In-memory GitHub Contents API fixture; never connects to GitHub or changes real invoices.
const assert=require('node:assert/strict');
const {_test}=require('../../netlify/functions/admin-invoices.cjs');
module.exports=function invoiceStorage(site,users=[]){
 const state={files:new Map(),users,writes:0,failWrite:0,beforeWrite:null,removeOnRead:null,lastMutation:null};let version=0;
 state.seed=invoice=>{state.files.set(`data/invoices/${invoice.id}.json`,{value:_test.encrypt(invoice),sha:`test-${++version}`});return invoice};
 state.invoice=id=>{const f=state.files.get(`data/invoices/${id}.json`);return f?_test.decrypt(f.value):null};
 global.fetch=async(url,options={})=>{
  const path=new URL(url).pathname.split('/contents/')[1];let status=200,body;
  if(['PUT','DELETE'].includes(options.method)){
   const request=JSON.parse(options.body);state.writes++;state.lastMutation={path,method:options.method,request};assert(request.message.includes('[skip ci]'));assert(!request.message.includes('Customer'));assert.equal(request.branch,process.env.GITHUB_BRANCH||'main');
   if(state.beforeWrite){const fn=state.beforeWrite;state.beforeWrite=null;fn(path)}
   const current=state.files.get(path);
   if(state.failWrite){status=state.failWrite;body={message:'Storage unavailable'}}
   else if((current&&request.sha!==current.sha)||(!current&&request.sha)){status=409;body={message:'SHA conflict'}}
   else if(options.method==='DELETE'){state.files.delete(path);body={content:null}}
   else{const value=JSON.parse(Buffer.from(request.content,'base64').toString());assert.equal(value.version,2);assert(!JSON.stringify(value).includes('Test Customer'));state.files.set(path,{value,sha:`test-${++version}`});body={content:{sha:`test-${version}`}}}
  }else if(path==='data/admin-users.enc.json')body={content:Buffer.from(JSON.stringify(require('../../netlify/functions/lib/crypto.cjs').encryptRecord(state.users,'administrators'))).toString('base64')};
  else if(path==='data/site.json')body={content:Buffer.from(JSON.stringify(site)).toString('base64')};
  else if(path==='data/invoices'){
   if(state.files.size)body=[...state.files.keys()].map(path=>({type:'file',name:path.split('/').pop(),path}));else{status=404;body={message:'Not Found'}}
  }else{if(state.removeOnRead===path){state.files.delete(path);state.removeOnRead=null}const f=state.files.get(path);if(f)body={content:Buffer.from(JSON.stringify(f.value)).toString('base64'),sha:f.sha};else{status=404;body={message:'Not Found'}}}
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};
 };
 state.security=require('./security-storage.cjs')();
 for(const user of users)state.security.seed(user);
 return state;
};

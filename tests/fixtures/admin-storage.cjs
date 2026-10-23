// In-memory GitHub fixture for authentication tests. No production network calls.
const crypto=require('node:crypto'),assert=require('node:assert/strict');
module.exports=site=>{
 let record=null,sha=null,version=0;const state={failRead:0,failWrite:0,beforeWrite:null,writes:0,reads:[],lastBody:null};
 const users=()=>{if(!record)return [];if(record.version===0)return structuredClone(record.users);const key=crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(),c=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'base64'));c.setAuthTag(Buffer.from(record.tag,'base64'));return JSON.parse(Buffer.concat([c.update(Buffer.from(record.data,'base64')),c.final()]).toString())};
 Object.defineProperty(state,'users',{get:users});Object.defineProperty(state,'record',{get:()=>record});
 state.seed=list=>{record={version:0,users:structuredClone(list)};sha=`test-${++version}`};
 state.conflict=()=>{sha=`concurrent-${++version}`};
 global.fetch=async(url,options={})=>{
  const path=new URL(url).pathname.split('/contents/')[1];let status=200,body;state.reads.push(path);
  if(path==='data/admin-users.enc.json'){
   if(options.method==='PUT'){
    state.writes++;const input=JSON.parse(options.body);state.lastBody=input;assert(input.message.includes('[skip ci]'));if(state.beforeWrite){const fn=state.beforeWrite;state.beforeWrite=null;fn()}
    if(state.failWrite){status=state.failWrite;body={message:'Test storage unavailable'}}else if((sha&&input.sha!==sha)||(!sha&&input.sha)){status=409;body={message:'Conflict'}}else{const next=JSON.parse(Buffer.from(input.content,'base64').toString());assert.equal(next.version,1);record=next;sha=`test-${++version}`;body={content:{sha}}}
   }else if(state.failRead){status=state.failRead;body={message:'Test storage unavailable'}}else if(record)body={sha,content:Buffer.from(JSON.stringify(record)).toString('base64')};else{status=404;body={message:'Not found'}}
  }else if(path==='data/site.json')body={sha:'site-test',content:Buffer.from(JSON.stringify(site)).toString('base64')};
  else if(path==='data/invoices')body=[];
  else{status=404;body={message:'Not found'}}
  return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};
 };
 return state;
};

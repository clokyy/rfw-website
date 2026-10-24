const assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.SESSION_SECRET='test-only-original-encryption-root';process.env.DATA_ENCRYPTION_KEY='test-only-independent-data-encryption-key';process.env.GITHUB_TOKEN='test-only';
const {migrate}=require('../scripts/migrate-encryption.cjs'),{decryptRecord}=require('../netlify/functions/lib/crypto.cjs');
const data=new Map();let writes=0;
function legacy(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(),iv),bytes=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);return {version:1,iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:bytes.toString('base64')}}
const id='00000000-0000-0000-0000-000000000001',values=[['data/admin-users.enc.json','administrators',[{username:'test-only-user'}]],['data/security.enc.json','mfa',{account:{secret:'test-only-mfa'}}],[`data/invoices/${id}.json`,'invoices',{customer:'test-only-customer'}]];
for(const [path,,value] of values)data.set(path,{record:legacy(value),sha:path+'-old'});
const api=async(raw,options={})=>{
 const path=raw.slice('contents/'.length).split('?')[0];
 if(path==='data/invoices')return [{name:id+'.json',type:'file'}];
 const file=data.get(path);if(!file){const error=Error();error.status=404;throw error}
 if(options.method==='PUT'){const input=JSON.parse(options.body);assert.equal(input.sha,file.sha);file.record=JSON.parse(Buffer.from(input.content,'base64').toString());file.sha+='-new';writes++;return {content:{sha:file.sha}}}
 return {sha:file.sha,content:Buffer.from(JSON.stringify(file.record)).toString('base64')};
};
(async()=>{
 assert.deepEqual(await migrate({api}),{records:3,applied:false});assert.equal(writes,0);
 await assert.rejects(()=>migrate({apply:true,api:async(raw,options)=>raw.startsWith('contents/data/invoices?')?Array(1000).fill({}):api(raw,options)}));assert.equal(writes,0);
 assert.deepEqual(await migrate({apply:true,api}),{records:3,applied:true});assert.equal(writes,3);
 for(const [path,purpose,value] of values){const record=data.get(path).record;assert.equal(record.version,2);assert.equal(record.keyId,'data-key');assert.deepEqual(decryptRecord(record,purpose),value)}
 process.env.SESSION_SECRET='test-only-rotated-signing-root';assert.deepEqual(await migrate({api}),{records:0,applied:false});
 console.log('Independent-key migration passed: dry run, complete preflight, listing guard, conditional writes, data preservation and root rotation');
})().catch(e=>{console.error(e);process.exitCode=1});

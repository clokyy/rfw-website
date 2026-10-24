// Operator-run only. No secrets or decrypted records are printed. Dry run by default.
const {github,BRANCH}=require('../netlify/functions/_lib.cjs');
const {encryptRecord,decryptRecord}=require('../netlify/functions/lib/crypto.cjs');
async function migrate({apply=false,api=github}={}){
 if(!process.env.DATA_ENCRYPTION_KEY||process.env.DATA_ENCRYPTION_KEY.length<32)throw Error('Set an independent DATA_ENCRYPTION_KEY of at least 32 characters');
 if(!process.env.LEGACY_ENCRYPTION_SECRET&&!process.env.SESSION_SECRET)throw Error('The original encryption secret is required');
 const plans=[];
 async function inspect(path,purpose){
  let file;try{file=await api(`contents/${path}?ref=${encodeURIComponent(BRANCH)}`)}catch(e){if(e.status===404)return;throw e}
  const record=JSON.parse(Buffer.from(file.content,'base64').toString());
  // Verify readability even when already using the independent key.
  const value=decryptRecord(record,purpose);
  if(record.version===2&&record.keyId==='data-key')return;
  plans.push({path,sha:file.sha,content:Buffer.from(JSON.stringify(encryptRecord(value,purpose))+'\n').toString('base64')});
 }
 await inspect('data/admin-users.enc.json','administrators');await inspect('data/security.enc.json','mfa');
 let entries=[];try{entries=await api(`contents/data/invoices?ref=${encodeURIComponent(BRANCH)}`)}catch(e){if(e.status!==404)throw e}
 if(!Array.isArray(entries)||entries.length>=1000)throw Error('Invoice listing may be incomplete; use a database migration instead');
 for(const entry of entries)if(entry.type==='file'&&/^[0-9a-f-]{36}\.json$/.test(entry.name))await inspect('data/invoices/'+entry.name,'invoices');
 // All records are decrypted/validated before the first write. SHA conflicts stop the migration.
 if(apply)for(const plan of plans)await api(`contents/${plan.path}`,{method:'PUT',body:JSON.stringify({branch:BRANCH,message:'Migrate encrypted storage to independent data key [skip ci]',sha:plan.sha,content:plan.content})});
 return {records:plans.length,applied:apply};
}
if(require.main===module){
 const args=process.argv.slice(2);if(args.some(a=>!['--apply','--dry-run'].includes(a))){console.error('Use --dry-run (default) or --apply');process.exitCode=1}
 else migrate({apply:args.includes('--apply')}).then(r=>console.log(`${r.applied?'Migrated':'Dry run: eligible'} records: ${r.records}. Preserve original keys and verify all data before rotating anything.`)).catch(e=>{console.error('Migration stopped. No secrets printed. Verify keys and storage permissions; any completed writes remain readable with the new key.');process.exitCode=1});
}
module.exports={migrate};

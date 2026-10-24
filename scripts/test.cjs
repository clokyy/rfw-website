const {spawnSync}=require('node:child_process'),path=require('node:path');
for(const file of ['barcodes','invoices','addresses','admin-onboarding','security','migration']){
 const result=spawnSync(process.execPath,[path.join(__dirname,'../tests',file+'.cjs')],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}

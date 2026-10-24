// Explicit public allowlist: never publish account records, invoices, MFA data, source, or tests.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const name of ['index.html','admin','assets','products','safety','_redirects'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true,dereference:false});
fs.mkdirSync(path.join(out,'data'));fs.copyFileSync(path.join(root,'data/site.json'),path.join(out,'data/site.json'));
console.log('Built public site; private account, invoice, and MFA records excluded.');

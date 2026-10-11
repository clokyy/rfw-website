const crypto=require('crypto');
const {json,getSession,readAdmins,github,BRANCH}=require('./_lib.cjs');
const DIR='data/invoices';
const clean=(v,n=200)=>String(v??'').trim().slice(0,n);
const key=()=>crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
function encrypt(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return {version:1,iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:data.toString('base64')}}
function decrypt(value){if(value.version!==1)throw new Error('Unsupported invoice format');const c=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(value.iv,'base64'));c.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([c.update(Buffer.from(value.data,'base64')),c.final()]).toString('utf8'))}
async function read(path){const f=await github(`contents/${path}?ref=${encodeURIComponent(BRANCH)}`);return JSON.parse(Buffer.from(f.content,'base64').toString('utf8'))}
function cents(v){if(!/^\d{1,7}(\.\d{1,2})?$/.test(String(v)))throw new Error('Enter a valid unit price (up to two decimals)');return Math.round(Number(v)*100)}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw new Error('Invalid due date');return v}
function build(input,site,creator){
 if(!clean(input.customer?.name))throw new Error('Customer name is required');
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw new Error('Select between 1 and 100 products');
 const items=input.items.map(line=>{const p=site.products[line.productIndex];if(!Number.isInteger(line.productIndex)||!p||p.name!==line.name||String(p.code||'')!==String(line.code||''))throw new Error('The product list changed. Reload the invoice builder and try again.');if(!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>10000)throw new Error('Quantity must be a whole number from 1 to 10,000');const unitPrice=cents(line.unitPrice);return {name:p.name,code:p.code||'',quantity:line.quantity,unitPrice,total:unitPrice*line.quantity}});
 const subtotal=items.reduce((s,l)=>s+l.total,0);if(subtotal>100000000)throw new Error('Invoice total exceeds the $1,000,000 limit');
 const taxRates=['gstRate','pstRate'].map(k=>{const v=String(input[k]??'0');if(!/^\d{1,2}(\.\d{1,2})?$/.test(v)||Number(v)>25)throw new Error('Tax rates must be between 0 and 25%');return Number(v)});
 const gst=Math.round(subtotal*taxRates[0]/100),pst=Math.round(subtotal*taxRates[1]/100),id=crypto.randomUUID(),createdAt=new Date().toISOString();
 return {id,number:`RF-${createdAt.slice(0,10).replace(/-/g,'')}-${id.slice(0,8).toUpperCase()}`,createdAt,createdBy:creator.username,creatorName:creator.displayName,creatorId:creator.id||creator.username,currency:'CAD',dueDate:input.dueDate?date(input.dueDate):null,customer:{name:clean(input.customer.name),email:clean(input.customer.email),phone:clean(input.customer.phone,60),address:clean(input.customer.address,1000)},seller:{name:'Regina Fireworks',address:clean([site.address_line1,[site.city,site.province,site.postal_code].filter(Boolean).join(', ')].filter(Boolean).join('\n'),1000),phone:site.phone_display,email:site.email},items,subtotal,gstRate:taxRates[0],pstRate:taxRates[1],gst,pst,total:subtotal+gst+pst,notes:clean(input.notes,2000)};
}
exports.handler=async event=>{
 const session=getSession(event);if(!session)return json(401,{error:'Authentication required'});
 try{
 const owner=String(process.env.ADMIN_USERNAME||'').trim().toLowerCase();const users=await readAdmins();const user=session.u===owner?{username:owner,firstName:process.env.ADMIN_FIRST_NAME,lastName:process.env.ADMIN_LAST_NAME}:users.find(u=>u.username===session.u&&u.id===session.id&&u.active!==false);if(!user)return json(401,{error:'This administrator account is no longer active'});const creator={username:user.username,id:user.id||'environment-owner',displayName:[user.firstName,user.lastName].filter(Boolean).join(' ')||user.username};
 if(event.httpMethod==='GET'){
  const id=event.queryStringParameters?.id;if(id){if(!/^[0-9a-f-]{36}$/.test(id))return json(400,{error:'Invalid invoice ID'});return json(200,{invoice:decrypt(await read(`${DIR}/${id}.json`))})}
  let files;try{files=await github(`contents/${DIR}?ref=${encodeURIComponent(BRANCH)}`)}catch(e){if(e.status===404)return json(200,{invoices:[]});throw e}
  const invoices=[];const queue=files.filter(f=>f.type==='file'&&/^[0-9a-f-]{36}\.json$/.test(f.name));await Promise.all(Array.from({length:Math.min(5,queue.length)},async()=>{while(queue.length){const f=queue.shift();const i=decrypt(await read(f.path));invoices.push({id:i.id,number:i.number,createdAt:i.createdAt,createdBy:i.createdBy,creatorName:i.creatorName,customerName:i.customer.name,total:i.total,currency:i.currency})}}));return json(200,{invoices:invoices.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
 }
 if(event.httpMethod==='POST'){
  if((event.body||'').length>100000)return json(413,{error:'Invoice request is too large'});const input=JSON.parse(event.body||'{}'),site=await read('data/site.json'),invoice=build(input,site,creator);await github(`contents/${DIR}/${invoice.id}.json`,{method:'PUT',body:JSON.stringify({message:'Create encrypted invoice record [skip ci]',branch:BRANCH,content:Buffer.from(JSON.stringify(encrypt(invoice))+'\n').toString('base64')})});return json(201,{invoice});
 }
 return json(405,{error:'Method not allowed'});
 }catch(e){if(e.status===404)return json(404,{error:'Invoice not found'});return json(e.status?502:400,{error:e.status?'Invoice storage is unavailable. Check the GitHub connection and try again.':e.message||'Unable to save invoice'})}
};
exports._test={build,encrypt,decrypt};

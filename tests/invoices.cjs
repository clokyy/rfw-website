const assert=require('node:assert/strict');
process.env.SESSION_SECRET='test-only-invoice-encryption-secret';process.env.ADMIN_USERNAME='owner';process.env.GITHUB_TOKEN='test-only';
const {handler,_test}=require('../netlify/functions/admin-invoices.cjs');const {sign}=require('../netlify/functions/_lib.cjs');
const site={products:[{name:'Test product',code:'001',price:'$12.34'}],address_line1:'Test address',city:'Regina',province:'SK',postal_code:'S0S 0S0',phone_display:'555',email:'test@example.com'};
const input={customer:{name:'Test Customer'},items:[{productIndex:0,name:'Test product',code:'001',quantity:3,unitPrice:'12.34'}],gstRate:'5',pstRate:'6',createdBy:'forged',status:'paid',paymentMethod:'cash',paidBy:'forged',paidAt:'2000-01-01'};
const invoice=_test.build(input,site,{username:'owner',displayName:'Store Owner'});assert.equal(invoice.subtotal,3702);assert.equal(invoice.gst,185);assert.equal(invoice.pst,222);assert.equal(invoice.total,4109);assert.equal(invoice.createdBy,'owner');assert.equal(invoice.status,'unpaid');assert.equal(invoice.paymentMethod,null);assert.equal(invoice.paidAt,null);assert.equal(invoice.paidBy,null);assert.deepEqual(_test.decrypt(_test.encrypt(invoice)),invoice);assert(!JSON.stringify(_test.encrypt(invoice)).includes('Test Customer'));
for(const bad of [{items:[]},{gstRate:-1},{gstRate:26},{dueDate:'2026-02-30'},{items:[{...input.items[0],quantity:0}]},{items:[{...input.items[0],unitPrice:'1.001'}]},{items:[{...input.items[0],name:'Changed product'}]}])assert.throws(()=>_test.build({...input,...bad},site,{username:'owner',displayName:'Store Owner'}));
const defaultInput={...input};delete defaultInput.gstRate;delete defaultInput.pstRate;const defaultInvoice=_test.build(defaultInput,site,{username:'owner',displayName:'Owner'});assert.equal(defaultInvoice.gstRate,5);assert.equal(defaultInvoice.pstRate,6);assert.equal(defaultInvoice.total,4109);const exempt=_test.build({...input,gstRate:'0',pstRate:'0'},site,{username:'owner',displayName:'Owner'});assert.equal(exempt.total,3702);
const storage=require('./fixtures/invoice-storage.cjs')(site,[{id:'active-id',username:'cashier',firstName:'Test',lastName:'Cashier',active:true},{id:'disabled-id',username:'disabled',active:false}]);
const cookie=u=>'rfw_admin='+sign({u:u||'owner',id:u==='cashier'?'active-id':u==='disabled'?'disabled-id':undefined,exp:Date.now()+60000});
const event=(method,body={},id,user)=>({httpMethod:method,headers:{cookie:cookie(user)},body:JSON.stringify(body),queryStringParameters:id?{id}:undefined});
const call=async(method,body,id,user)=>{const r=await handler(event(method,body,id,user));return {status:r.statusCode,...JSON.parse(r.body)}};
(async()=>{
 assert.equal((await handler({httpMethod:'GET',headers:{}})).statusCode,401);assert.deepEqual((await call('GET')).invoices,[]);
 const saved=await call('POST',input);assert.equal(saved.status,201);const i=saved.invoice;assert.equal(i.createdBy,'owner');assert.equal(i.creatorName,'owner');assert.equal(i.status,'unpaid');assert.equal((await call('GET')).invoices[0].total,4109);assert.deepEqual((await call('GET',{},i.id)).invoice,i);assert.equal((await call('GET',{},'../site')).status,400);
 for(const method of ['PATCH','DELETE']){
  assert.equal((await handler({...event(method,{},i.id),headers:{}})).statusCode,401);
  for(const user of ['removed-admin','disabled'])assert.equal((await call(method,{},i.id,user)).status,401);
  for(const id of ['../site','------------------------------------','ffffffff-ffff-ffff-ffff-fffffffffffz'])assert.equal((await call(method,{},id)).status,400);
  const oversized=event(method,{},i.id);oversized.body='x'.repeat(2001);assert.equal((await handler(oversized)).statusCode,413);
  const malformed=event(method,{},i.id);malformed.body='{';assert.equal((await handler(malformed)).statusCode,400);
 }
 const paidInput={action:'mark-paid',paymentMethod:'cash',paidBy:'forged',paidAt:'2000-01-01',total:0};
 const before=storage.writes;
 for(const body of [{},{action:'mark-paid'},{...paidInput,paymentMethod:'credit-card'},{...paidInput,paymentMethod:'Cash'},{action:'unpaid',paymentMethod:'cash'}])assert.equal((await call('PATCH',body,i.id)).status,400);
 assert.equal((await call('DELETE',{},i.id)).status,400);assert.equal((await call('DELETE',{confirmNumber:'wrong'},i.id)).status,400);assert.equal(storage.writes,before);
 storage.failWrite=503;assert.equal((await call('PATCH',paidInput,i.id)).status,502);assert.equal(storage.invoice(i.id).status,'unpaid');assert.equal((await call('DELETE',{confirmNumber:i.number},i.id)).status,502);assert(storage.invoice(i.id));assert.equal((await call('POST',input)).status,502);storage.failWrite=0;
 storage.beforeWrite=path=>{storage.files.get(path).sha='concurrent-edit'};assert.equal((await call('PATCH',paidInput,i.id)).status,409);assert.equal(storage.invoice(i.id).status,'unpaid');
 const paid=await call('PATCH',paidInput,i.id,'cashier');assert.equal(paid.status,200);assert.equal(paid.invoice.status,'paid');assert.equal(paid.invoice.paymentMethod,'cash');assert.equal(paid.invoice.paidBy,'cashier');assert.equal(paid.invoice.paidByName,'Test Cashier');assert.notEqual(paid.invoice.paidAt,'2000-01-01');assert(Number.isFinite(Date.parse(paid.invoice.paidAt)));
 for(const field of Object.keys(i).filter(k=>!['status','paymentMethod','paidAt','paidBy','paidByName'].includes(k)))assert.deepEqual(paid.invoice[field],i[field]);
 assert.deepEqual(storage.invoice(i.id),paid.invoice);assert.deepEqual((await call('GET',{},i.id)).invoice,paid.invoice);assert.equal((await call('GET')).invoices[0].paymentMethod,'cash');
 const writes=storage.writes;assert.deepEqual((await call('PATCH',paidInput,i.id)).invoice,paid.invoice);assert.equal(storage.writes,writes);assert.equal((await call('PATCH',{...paidInput,paymentMethod:'e-transfer'},i.id)).status,409);assert.equal(storage.writes,writes);
 const legacy=_test.build(input,site,{username:'original',displayName:'Original Creator'});for(const key of ['status','paymentMethod','paidAt','paidBy','paidByName'])delete legacy[key];storage.seed(legacy);assert.equal((await call('GET',{},legacy.id)).invoice.status,'unpaid');assert.equal((await call('GET')).invoices.find(x=>x.id===legacy.id).status,'unpaid');
 const transfer=await call('PATCH',{...paidInput,paymentMethod:'e-transfer'},legacy.id);assert.equal(transfer.status,200);assert.equal(transfer.invoice.paymentMethod,'e-transfer');assert.equal(transfer.invoice.createdBy,'original');assert.deepEqual(transfer.invoice.items,legacy.items);
 storage.beforeWrite=path=>{storage.files.get(path).sha='concurrent-remove'};assert.equal((await call('DELETE',{confirmNumber:legacy.number},legacy.id)).status,409);assert(storage.invoice(legacy.id));
 const deleted=await call('DELETE',{confirmNumber:legacy.number},legacy.id,'cashier');assert.equal(deleted.status,200);assert.equal(deleted.removed,true);assert.equal(deleted.id,legacy.id);assert.equal(storage.invoice(legacy.id),null);assert.equal((await call('GET',{},legacy.id)).status,404);assert.equal((await call('PATCH',paidInput,legacy.id)).status,404);assert.equal((await call('DELETE',{confirmNumber:legacy.number},legacy.id)).status,404);assert.equal((await call('GET')).invoices.length,1);
 // A deletion after listing must not break the entire register request.
 const temporary=storage.seed(_test.build(input,site,{username:'owner',displayName:'Owner'}));storage.removeOnRead=`data/invoices/${temporary.id}.json`;assert.equal((await call('GET')).invoices.length,1);
 assert.equal((await call('DELETE',{confirmNumber:i.number},i.id)).status,200);assert.deepEqual((await call('GET')).invoices,[]);assert.equal((await call('PUT')).status,405);
 console.log('PASS: invoice creation/taxes/encryption; unpaid legacy records; cash/e-transfer; server attribution; immutable totals; repeat-payment safety; active-admin authorization; confirmed deletion; storage errors/concurrency');
})().catch(e=>{console.error(e);process.exit(1)});

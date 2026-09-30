const {json,requireAuth,github,BRANCH}=require('./_lib.cjs');
const filePath='data/site.json';
const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
function validate(input){
 const d=input?.data;if(!d||typeof d!=='object'||!Array.isArray(d.products))throw new Error('Invalid website data');
 if(d.products.length>500)throw new Error('Product limit exceeded');
 const out={phone_display:clean(d.phone_display,40),phone_link:clean(d.phone_link,30),address_line1:clean(d.address_line1),city:clean(d.city,100),province:clean(d.province,100),postal_code:clean(d.postal_code,20),email:clean(d.email,200),products:[]};
 if(!/^\S+@\S+\.\S+$/.test(out.email))throw new Error('Enter a valid email address');
 for(const p of d.products){
  const image=clean(p.image,1200);if(image&&!(/^https:\/\//.test(image)||/^\/assets\/uploads\/[a-zA-Z0-9._-]+$/.test(image)))throw new Error(`Invalid image path for ${clean(p.name)}`);
  out.products.push({name:clean(p.name),code:clean(p.code,60),category:clean(p.category,100),type:clean(p.type,100),price:clean(p.price,60),details:clean(p.details,2000),theme:clean(p.theme,30)||'blue',active:p.active!==false,image});
 }
 return out;
}
exports.handler=async event=>{
 const denied=requireAuth(event);if(denied)return denied;
 try{
  if(event.httpMethod==='GET'){const f=await github(`contents/${filePath}?ref=${encodeURIComponent(BRANCH)}`);return json(200,{data:JSON.parse(Buffer.from(f.content,'base64').toString()),sha:f.sha})}
  if(event.httpMethod==='PUT'){const input=JSON.parse(event.body||'{}'),data=validate(input);const body={message:'Update website content from admin panel',content:Buffer.from(JSON.stringify(data,null,2)+'\n').toString('base64'),branch:BRANCH,sha:input.sha};const r=await github(`contents/${filePath}`,{method:'PUT',body:JSON.stringify(body)});return json(200,{ok:true,sha:r.content.sha,commit:r.commit.html_url})}
  return json(405,{error:'Method not allowed'});
 }catch(e){return json(400,{error:e.message||'Request failed'})}
};

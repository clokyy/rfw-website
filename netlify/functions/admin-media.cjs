const {json,requireAuth,github,BRANCH}=require('./_lib.cjs');
const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
exports.handler=async event=>{
 const denied=requireAuth(event);if(denied)return denied;if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 try{
  const x=JSON.parse(event.body||'{}'),ext=allowed[x.mimeType];if(!ext)throw new Error('Only JPG, PNG, WebP, and GIF images are allowed');
  const data=String(x.data||'').replace(/^data:[^;]+;base64,/,'');const bytes=Buffer.from(data,'base64');if(!bytes.length||bytes.length>5*1024*1024)throw new Error('Images must be smaller than 5 MB');
  const stem=String(x.filename||'product').replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'product';const name=`${Date.now()}-${stem}.${ext}`,path=`assets/uploads/${name}`;
  await github(`contents/${path}`,{method:'PUT',body:JSON.stringify({message:`Upload product image: ${name}`,content:bytes.toString('base64'),branch:BRANCH})});return json(200,{ok:true,path:`/${path}`});
 }catch(e){return json(400,{error:e.message||'Upload failed'})}
};

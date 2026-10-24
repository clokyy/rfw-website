const crypto=require('node:crypto');
const {json,requireAuth,github,BRANCH}=require('./_lib.cjs');
const allowed={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp','image/gif':'gif'};
async function sanitizeImage(input){
 const expected=allowed[input.mimeType];if(!expected)throw Error('Only JPG, PNG, WebP, and GIF images are allowed');
 const encoded=String(input.data||'').replace(/^data:[^;]+;base64,/,'');
 if(!encoded.length||encoded.length>6990510||encoded.length%4!==0||! /^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw Error('Invalid image data');
 const bytes=Buffer.from(encoded,'base64');if(!bytes.length||bytes.length>5*1024*1024)throw Error('Images must be smaller than 5 MB');
 // Inspect raster magic before passing bytes to a decoder. Never accept SVG, PDF, or arbitrary markup.
 const detected=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':/^GIF8[79]a$/.test(bytes.subarray(0,6).toString())?'gif':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'webp':null;
 if(detected!==expected)throw Error('Image contents do not match the selected file type');
 const sharp=require('sharp');
 const image=sharp(bytes,{limitInputPixels:24000000,failOn:'warning',animated:false});
 const metadata=await image.metadata();
 if(metadata.format!==expected||!metadata.width||!metadata.height||metadata.width>12000||metadata.height>12000)throw Error('Invalid image or image dimensions are too large');
 // Only the first GIF/WebP frame is retained. Re-encoding strips metadata and trailing payloads.
 const result=await image.rotate().resize({width:4000,height:4000,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
 if(result.length>5*1024*1024)throw Error('Processed image is too large');return result;
}
exports.handler=async event=>{
 const denied=await requireAuth(event);if(denied)return denied;if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 if((event.body||'').length>7100000)return json(413,{error:'Image request is too large'});
 try{
  const input=JSON.parse(event.body||'{}'),bytes=await sanitizeImage(input);
  const stem=String(input.filename||'product').replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'product';
  const path=`assets/uploads/${crypto.randomUUID()}-${stem}.webp`;
  await github(`contents/${path}`,{method:'PUT',body:JSON.stringify({message:'Upload validated product image',content:bytes.toString('base64'),branch:BRANCH})});return json(200,{ok:true,path:`/${path}`});
 }catch(e){return json(e.status?503:400,{error:e.status?'Image storage is temporarily unavailable':'Upload failed. Use a valid JPG, PNG, WebP, or GIF under 5 MB (maximum 24 megapixels).'})}
};
exports._test={sanitizeImage};

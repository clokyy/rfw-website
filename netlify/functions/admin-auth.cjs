const {json,safeEqual,sign,verify}=require('./_lib.cjs');
exports.handler=async event=>{
 if(event.httpMethod==='GET')return json(200,{authenticated:verify(event)});
 if(event.httpMethod==='DELETE')return json(200,{ok:true},{'Set-Cookie':'rfw_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET)return json(503,{error:'Admin login is not configured'});
 let input={};try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
 const ok=safeEqual(input.username||'',process.env.ADMIN_USERNAME)&&safeEqual(input.password||'',process.env.ADMIN_PASSWORD);
 if(!ok)return json(401,{error:'Invalid username or password'});
 const token=sign({u:process.env.ADMIN_USERNAME,exp:Date.now()+8*60*60*1000});
 return json(200,{ok:true},{'Set-Cookie':`rfw_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
};

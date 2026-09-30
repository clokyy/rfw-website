const {json,safeEqual,sign,verify,readAdmins,verifyPassword}=require('./_lib.cjs');
exports.handler=async event=>{
 if(event.httpMethod==='GET')return json(200,{authenticated:verify(event)});
 if(event.httpMethod==='DELETE')return json(200,{ok:true},{'Set-Cookie':'rfw_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET)return json(503,{error:'Admin login is not configured'});
 let input={};try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
 const username=String(input.username||'').trim().toLowerCase();let role='',id='';
 const ownerOk=safeEqual(username,String(process.env.ADMIN_USERNAME).trim().toLowerCase())&&safeEqual(input.password||'',process.env.ADMIN_PASSWORD);
 if(ownerOk){role='owner';id='environment-owner'}else{try{const users=await readAdmins(),user=users.find(x=>x.username===username&&x.active!==false);if(user&&verifyPassword(input.password||'',user)){role='admin';id=user.id}}catch(e){return json(503,{error:'Administrator storage is temporarily unavailable'})}}
 if(!role)return json(401,{error:'Invalid username or password'});
 const token=sign({u:username,id,role,exp:Date.now()+8*60*60*1000});return json(200,{ok:true},{'Set-Cookie':`rfw_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
};

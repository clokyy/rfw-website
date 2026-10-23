const {json,safeEqual,readAdmins,verifyPassword,authorize,sessionCookie}=require('./_lib.cjs');
exports.handler=async event=>{
 if(event.httpMethod==='DELETE')return json(200,{ok:true},{'Set-Cookie':'rfw_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(event.httpMethod==='GET'){
  const auth=await authorize(event,{allowPasswordChange:true});if(auth.denied)return auth.denied.statusCode===401?json(200,{authenticated:false}):auth.denied;
  return json(200,{authenticated:true,mustChangePassword:auth.user.mustChangePassword===true,username:auth.user.username});
 }
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET)return json(503,{error:'Admin login is not configured'});
 if((event.body||'').length>2000)return json(413,{error:'Sign-in request is too large'});
 let input;try{input=JSON.parse(event.body||'{}');if(!input||typeof input!=='object')throw Error()}catch{return json(400,{error:'Invalid request'})}
 const username=String(input.username||'').trim().toLowerCase();let role='',user;
 const ownerOk=safeEqual(username,String(process.env.ADMIN_USERNAME).trim().toLowerCase())&&safeEqual(input.password||'',process.env.ADMIN_PASSWORD);
 if(ownerOk){role='owner';user={username,id:'environment-owner'}}else{try{const users=await readAdmins();user=users.find(x=>x.username===username&&x.active!==false);if(user&&verifyPassword(input.password||'',user))role='admin'}catch{return json(503,{error:'Administrator storage is temporarily unavailable'})}}
 if(!role)return json(401,{error:'Invalid username or password'});
 return json(200,{ok:true,mustChangePassword:user.mustChangePassword===true,username},{'Set-Cookie':sessionCookie(user,role)});
};

const {json,safeEqual,readAdmins,verifyPassword,authorize,sessionCookie}=require('./_lib.cjs');
const {checkWrite}=require('./lib/request.cjs');
exports.handler=async event=>{
 const rejected=checkWrite(event);if(rejected)return json(403,{error:rejected});
 if(event.httpMethod==='DELETE')return json(200,{ok:true},{'Set-Cookie':'rfw_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(event.httpMethod==='GET'){
  const auth=await authorize(event,{allowPasswordChange:true,allowMfa:true});if(auth.denied)return auth.denied.statusCode===401?json(200,{authenticated:false}):auth.denied;
  if(auth.session.mfa===true){const verified=await authorize(event);if(verified.denied)return verified.denied}
  return json(200,{authenticated:true,mustChangePassword:auth.user.mustChangePassword===true,mfaRequired:auth.session.mfa!==true,username:auth.user.username});
 }
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET)return json(503,{error:'Admin login is not configured'});
 if((event.body||'').length>2000)return json(413,{error:'Sign-in request is too large'});
 let input;try{input=JSON.parse(event.body||'{}');if(!input||typeof input!=='object')throw Error()}catch{return json(400,{error:'Invalid request'})}
 if(typeof input.username!=='string'||typeof input.password!=='string'||input.username.length>128||input.password.length>128)return json(400,{error:'Invalid sign-in request'});
 const username=input.username.trim().toLowerCase();let role='',user;
 const ownerOk=safeEqual(username,String(process.env.ADMIN_USERNAME).trim().toLowerCase())&&safeEqual(input.password||'',process.env.ADMIN_PASSWORD);
 if(ownerOk){role='owner';user={username,id:'environment-owner'}}else{try{const users=await readAdmins();user=users.find(x=>x.username===username&&x.active!==false);if(user&&verifyPassword(input.password||'',user))role='admin'}catch{return json(503,{error:'Administrator storage is temporarily unavailable'})}}
 if(!role)return json(401,{error:'Invalid username or password'});
 return json(200,{ok:true,mfaRequired:true,mustChangePassword:user.mustChangePassword===true,username},{'Set-Cookie':sessionCookie(user,role)});
};

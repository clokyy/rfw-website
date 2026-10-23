const crypto=require('crypto');
const {json,authorize,hashPassword,verifyPassword,writeAdmins,sessionCookie}=require('./_lib.cjs');
exports.handler=async event=>{
 const auth=await authorize(event,{allowPasswordChange:true});if(auth.denied)return auth.denied;
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 if(auth.owner||auth.user.mustChangePassword!==true)return json(403,{error:'This account does not require a first-sign-in password change'});
 if((event.body||'').length>2000)return json(413,{error:'Password request is too large'});
 let input;try{input=JSON.parse(event.body||'{}');if(!input||typeof input!=='object')throw Error()}catch{return json(400,{error:'Invalid request'})}
 const password=typeof input.newPassword==='string'?input.newPassword:'';
 if(password.length<12||password.length>128||!password.trim())return json(400,{error:'Choose a password between 12 and 128 characters'});
 if(password!==input.confirmPassword)return json(400,{error:'The new passwords do not match'});
 if(verifyPassword(password,auth.user))return json(400,{error:'Choose a new password different from your temporary password'});
 try{
  const h=hashPassword(password);Object.assign(auth.user,{salt:h.salt,passwordHash:h.hash,mustChangePassword:false,passwordVersion:crypto.randomUUID(),passwordChangedAt:new Date().toISOString()});
  await writeAdmins(auth.users,auth.sha);
  return json(200,{ok:true},{'Set-Cookie':sessionCookie(auth.user)});
 }catch(e){return json(e.status===409?409:503,{error:e.status===409?'The administrator record changed. Reload and try again.':'Unable to save your new password. Please try again.'})}
};

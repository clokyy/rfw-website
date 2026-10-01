const crypto=require('crypto');
const {json,getSession,readAdmins,writeAdmins,hashPassword}=require('./_lib.cjs');
const validName=u=>/^[a-z0-9._-]{3,32}$/.test(u);
const clean=v=>String(v||'').trim().replace(/\s+/g,' ').slice(0,80);
const displayName=u=>[u.firstName,u.lastName].filter(Boolean).join(' ')||u.username;
function publicUser(u,extra={}){return {username:u.username,firstName:u.firstName||'',lastName:u.lastName||'',displayName:displayName(u),...extra}}
exports.handler=async event=>{
 const session=getSession(event);if(!session)return json(401,{error:'Authentication required'});
 try{
  let users=await readAdmins();const owner=String(process.env.ADMIN_USERNAME||'').trim().toLowerCase();
  const ownerUser=publicUser({username:owner,firstName:clean(process.env.ADMIN_FIRST_NAME),lastName:clean(process.env.ADMIN_LAST_NAME)},{role:'Owner',protected:true});
  if(event.httpMethod==='GET'){
   const publicUsers=[ownerUser,...users.map(x=>publicUser(x,{role:'Administrator',createdAt:x.createdAt,createdBy:x.createdBy,protected:false}))];
   const currentUser=publicUsers.find(x=>x.username===session.u)||publicUser({username:session.u},{role:session.role||'Administrator',protected:false});
   return json(200,{current:session.u,currentUser,users:publicUsers});
  }
  const input=JSON.parse(event.body||'{}');
  if(event.httpMethod==='POST'){
   const username=String(input.username||'').trim().toLowerCase(),password=String(input.password||''),firstName=clean(input.firstName),lastName=clean(input.lastName);
   if(!validName(username))throw new Error('Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores');
   if(!firstName||!lastName)throw new Error('First name and last name are required');
   if(password.length<12)throw new Error('Password must be at least 12 characters');
   if(username===owner||users.some(x=>x.username===username))throw new Error('That username already exists');
   const h=hashPassword(password);users.push({id:crypto.randomUUID(),username,firstName,lastName,salt:h.salt,passwordHash:h.hash,active:true,createdAt:new Date().toISOString(),createdBy:session.u});
   await writeAdmins(users);return json(201,{ok:true});
  }
  if(event.httpMethod==='PUT'){
   const username=String(input.username||'').trim().toLowerCase(),password=String(input.password||''),firstName=input.firstName===undefined?undefined:clean(input.firstName),lastName=input.lastName===undefined?undefined:clean(input.lastName);
   const user=users.find(x=>x.username===username);if(!user)throw new Error('Administrator not found');
   if(password){if(password.length<12)throw new Error('Password must be at least 12 characters');const h=hashPassword(password);user.salt=h.salt;user.passwordHash=h.hash}
   if(firstName!==undefined){if(!firstName)throw new Error('First name is required');user.firstName=firstName}
   if(lastName!==undefined){if(!lastName)throw new Error('Last name is required');user.lastName=lastName}
   await writeAdmins(users);return json(200,{ok:true});
  }
  if(event.httpMethod==='DELETE'){
   const username=String(input.username||'').trim().toLowerCase();if(username===owner)throw new Error('The owner account cannot be removed');if(username===session.u)throw new Error('You cannot remove your own account');const next=users.filter(x=>x.username!==username);if(next.length===users.length)throw new Error('Administrator not found');await writeAdmins(next);return json(200,{ok:true});
  }
  return json(405,{error:'Method not allowed'});
 }catch(e){return json(400,{error:e.message||'Request failed'})}
};

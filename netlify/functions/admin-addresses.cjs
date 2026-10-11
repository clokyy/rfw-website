const {json,getSession,readAdmins}=require('./_lib.cjs');
const clean=(v,n=200)=>String(v??'').trim().slice(0,n);
exports.handler=async event=>{
 const session=getSession(event);if(!session)return json(401,{error:'Authentication required'});
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
 try{
  const owner=String(process.env.ADMIN_USERNAME||'').trim().toLowerCase();
  if(session.u!==owner){const users=await readAdmins();if(!users.some(u=>u.username===session.u&&u.id===session.id&&u.active!==false))return json(401,{error:'This administrator account is no longer active'})}
  const key=process.env.GEOAPIFY_API_KEY;if(!key)return json(503,{error:'Address suggestions are not configured yet. Enter the address manually, or add GEOAPIFY_API_KEY in Netlify.'});
  if((event.body||'').length>2000)return json(400,{error:'Address search is too long'});
  let input;try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid address search'})}
  const text=clean(input.text);if(text.length<3)return json(200,{suggestions:[]});
  const params=new URLSearchParams({text,format:'json',limit:'5',lang:'en',filter:'countrycode:ca',bias:'proximity:-104.6189,50.4452',apiKey:key});
  const response=await fetch('https://api.geoapify.com/v1/geocode/autocomplete?'+params,{signal:AbortSignal.timeout(5000)});
  if(!response.ok)return json(response.status===429?429:502,{error:response.status===429?'Address lookup limit reached. Please enter the address manually.':'Address suggestions are temporarily unavailable. Please enter the address manually.'});
  const result=await response.json();const suggestions=(Array.isArray(result.results)?result.results:[]).slice(0,5).map(p=>({label:clean(p.formatted,500),street:clean(p.address_line1||[p.housenumber,p.street].filter(Boolean).join(' ')),city:clean(p.city||p.town||p.village||p.municipality,100),province:clean(p.state||p.state_code,100),postalCode:clean(p.postcode,20).toUpperCase(),country:clean(p.country||'Canada',100)})).filter(p=>p.label&&p.street);
  return json(200,{suggestions});
 }catch{return json(502,{error:'Address suggestions are temporarily unavailable. Please enter the address manually.'})}
};

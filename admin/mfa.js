// Authenticator secrets and recovery codes are displayed only in this document, never localStorage.
(() => {
 const $=s=>document.querySelector(s);let finish;
 async function api(method='GET',data){
  const response=await fetch('/.netlify/functions/admin-mfa',{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||(response.status===429?'Too many attempts. Wait one minute before trying again.':'Unable to verify. Please try again.'));return body;
 }
 function clearEnrollment(){ $('#mfa-secret').textContent='';$('#mfa-qr').removeAttribute('src');$('#mfa-qr').hidden=true;$('#mfa-enrollment').hidden=true; }
 function drawQr(uri){
  try{const qr=qrcode(0,'M');qr.addData(uri,'Byte');qr.make();$('#mfa-qr').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr.createSvgTag({cellSize:6,margin:24}));$('#mfa-qr').hidden=false;$('#mfa-qr-help').textContent='Cannot scan it? Add a time-based account named Regina Fireworks using this setup key:'}
  catch{ $('#mfa-qr-help').textContent='QR code unavailable. Add a time-based account named Regina Fireworks using the setup key below.'; }
 }
 function clear(){ clearEnrollment();$('#mfa-recovery-codes').textContent='';$('#mfa-code-form').reset();$('#mfa-error').textContent=''; }
 async function show(onFinish){
  finish=onFinish;clear();$('#mfa-recovery').hidden=true;$('#mfa-code-form').hidden=true;$('#mfa-enrollment').hidden=true;
  $('#mfa-status').textContent='Checking two-step verification…';$('#mfa-view').hidden=false;
  try{
   const status=await api();
   if(!status.enrolled){const setup=await api('POST',{action:'begin'});$('#mfa-secret').textContent=setup.secret;drawQr(setup.uri);$('#mfa-enrollment').hidden=false}
   $('#mfa-status').textContent=status.enrolled?'Enter the current six-digit code from your authenticator app, or an unused recovery code.':'Scan the QR code or enter the setup key in your authenticator app, then enter its six-digit code.';
   $('#mfa-code-form').hidden=false;$('#mfa-code').focus();
  }catch(error){$('#mfa-error').textContent=error.message;$('#mfa-status').textContent='Sign out and sign in again if your setup session has expired.'}
 }
 $('#mfa-code-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#mfa-verify');button.disabled=true;$('#mfa-error').textContent='';
  try{
   const result=await api('POST',{code:$('#mfa-code').value});$('#mfa-code-form').reset();clearEnrollment();
   if(result.recoveryCodes){$('#mfa-code-form').hidden=true;$('#mfa-status').textContent='Two-step verification is enabled.';$('#mfa-recovery-codes').textContent=result.recoveryCodes.join('\n');$('#mfa-recovery').hidden=false;$('#mfa-continue').focus()}
   else{clear();$('#mfa-view').hidden=true;await finish()}
  }catch(error){$('#mfa-error').textContent=error.message}finally{button.disabled=false}
 });
 $('#mfa-continue').addEventListener('click',async()=>{clear();$('#mfa-view').hidden=true;await finish()});
 $('#mfa-signout').addEventListener('click',async()=>{
  try{const response=await fetch('/.netlify/functions/admin-auth',{method:'DELETE'});if(!response.ok)throw Error('Unable to sign out. Please try again.');clear();$('#mfa-view').hidden=true;await finish()}
  catch(error){$('#mfa-error').textContent=error.message}
 });
 window.RFWMfa={show,clear};
})();

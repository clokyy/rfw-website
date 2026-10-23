/* USB scanners use a focused keyboard input; camera decoding is entirely local. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s),input=$('#invoice-barcode'),status=$('#invoice-scan-status'),video=$('#invoice-camera-video');
 let epoch=0,stream=null,controls=null,armed=false,library=null;
 function report(message,kind='ready'){status.textContent=message;status.dataset.kind=kind}
 function addBarcode(raw){const value=String(raw||'').trim().replace(/^\]C[01]/,'').toUpperCase();if(!value){report('Scan or enter the barcode printed on an asset tag.','error');return false}if($('#save-invoice').disabled){report('Wait for the invoice to finish saving before scanning.','error');return false}const request={value,result:null};document.dispatchEvent(new CustomEvent('rfw-scan-product',{detail:request}));const r=request.result;if(!r||r.error){report(r?.error||'The invoice scanner is not ready. Reopen the invoice and try again.','error');return false}report(`Added ${r.name} · Quantity ${r.quantity}.${r.needsPrice?' Enter a unit price before saving.':''}`,'success');return true}
 function scanInput(){if(addBarcode(input.value))input.value='';else input.select();input.focus({preventScroll:true})}
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();scanInput()}});$('#invoice-scan-add').addEventListener('click',scanInput);
 function stopCamera(message){++epoch;armed=false;try{Promise.resolve(controls?.stop()).catch(()=>{})}catch{}controls=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;$('#invoice-camera').hidden=true;$('#start-invoice-camera').disabled=false;$('#start-invoice-camera').textContent='Scan with iPhone / camera';$('#invoice-camera-next').disabled=true;if(message)report(message)}
 function loadReader(){if(window.ZXingBrowser)return Promise.resolve(window.ZXingBrowser);if(library)return library;library=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/admin/vendor/zxing-browser.min.js';s.onload=()=>window.ZXingBrowser?resolve(window.ZXingBrowser):reject(new Error('Scanner library unavailable'));s.onerror=()=>{s.remove();library=null;reject(new Error('Scanner library unavailable'))};document.head.append(s)});return library}
 $('#start-invoice-camera').addEventListener('click',async()=>{
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){report('Camera scanning requires HTTPS and a browser with camera access. Open this site in Safari on your iPhone, or use a USB scanner / manual lookup.','error');return}
  input.blur();stopCamera();const token=epoch;$('#start-invoice-camera').disabled=true;$('#start-invoice-camera').textContent='Opening camera…';report('Allow camera access when your browser asks.');
  try{
   const ZXing=await loadReader();if(token!==epoch)return;
   const requested=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
   if(token!==epoch||!$('#invoice-dialog').open){requested.getTracks().forEach(t=>t.stop());return}stream=requested;$('#invoice-camera').hidden=false;armed=true;
   const reader=new ZXing.BrowserMultiFormatOneDReader(undefined,{delayBetweenScanAttempts:200,delayBetweenScanSuccess:400,tryPlayVideoTimeout:10000});
   const pending=await reader.decodeFromStream(requested,video,result=>{if(!result||!armed||token!==epoch||!$('#invoice-dialog').open)return;armed=false;addBarcode(result.getText());$('#invoice-camera-next').disabled=false});
   if(token!==epoch){pending.stop();return}controls=pending;$('#start-invoice-camera').textContent='Camera running';if(armed)report('Camera ready. Hold one barcode steady inside the preview.');
  }catch(error){if(token!==epoch)return;stopCamera();const message=error.name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser settings, then try again.':error.name==='NotFoundError'?'No camera was found on this device.':error.name==='NotReadableError'?'The camera is in use by another app. Close it and try again.':'Unable to start the camera. Check your connection and camera access, then try again.';report(message+' USB scanning and manual lookup are still available.','error')}
 });
 $('#invoice-camera-next').addEventListener('click',()=>{armed=true;$('#invoice-camera-next').disabled=true;report('Ready for the next item. Hold one barcode steady inside the preview.')});
 $('#stop-invoice-camera').addEventListener('click',()=>{stopCamera('Camera stopped. USB scanning is ready.');input.focus({preventScroll:true})});
 $('#invoice-dialog').addEventListener('close',()=>stopCamera());$('#invoice-form').addEventListener('submit',()=>stopCamera());
 document.addEventListener('rfw-invoice-open',()=>{stopCamera();input.value='';report('Ready to scan Regina Fireworks asset tags.');if(!matchMedia('(pointer: coarse)').matches)input.focus({preventScroll:true})});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera('Camera stopped while the page was hidden. Tap Scan with iPhone / camera to restart.')});addEventListener('pagehide',()=>stopCamera());
})();

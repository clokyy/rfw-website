(() => {
 const input=document.querySelector('#billing-street'),list=document.querySelector('#billing-suggestions'),status=document.querySelector('#billing-address-status'),form=document.querySelector('#invoice-form'),dialog=document.querySelector('#invoice-dialog');
 const hint='Type at least 3 characters for Canadian address suggestions. You can also enter all fields manually.';
 let timer,controller,version=0,suggestions=[],active=-1,loading=false;
 function hide(){list.hidden=true;list.replaceChildren();input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');suggestions=[];active=-1}
 function cancel(){clearTimeout(timer);controller?.abort();controller=null;version++;loading=false;hide()}
 function choose(index){const s=suggestions[index];if(!s)return;input.value=s.street;form.elements.customerCity.value=s.city;form.elements.customerProvince.value=s.province;const postal=s.postalCode.replace(/\s/g,'').toUpperCase();form.elements.customerPostalCode.value=/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(postal)?postal.slice(0,3)+' '+postal.slice(3):s.postalCode;form.elements.customerCountry.value=s.country;cancel();status.textContent='Address filled. Please confirm the details and add an apartment or unit if needed.';form.elements.customerUnit.focus()}
 function highlight(index){active=index;[...list.children].forEach((el,i)=>{el.setAttribute('aria-selected',String(i===index));el.classList.toggle('selected',i===index)});if(index>=0){input.setAttribute('aria-activedescendant','billing-option-'+index);list.children[index]?.scrollIntoView({block:'nearest'})}}
 function render(rows){hide();suggestions=rows;if(!rows.length){status.textContent='No matching addresses. Continue typing or enter the address manually.';return}rows.forEach((s,index)=>{const option=document.createElement('div');option.id='billing-option-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=s.label;option.addEventListener('mousedown',e=>e.preventDefault());option.addEventListener('click',()=>choose(index));list.append(option)});list.hidden=false;input.setAttribute('aria-expanded','true');status.textContent=`${rows.length} address suggestions. Select one or use the arrow keys and Enter.`}
 function lookup(){
  cancel();const text=input.value.trim();status.textContent=hint;if(text.length<3)return;
  const requestVersion=version;
  timer=setTimeout(async()=>{
   if(requestVersion!==version||!dialog.open||document.activeElement!==input)return;
   const requestController=new AbortController();controller=requestController;loading=true;let timedOut=false;
   const timeout=setTimeout(()=>{timedOut=true;requestController.abort()},8000);
   status.textContent='Looking up addresses…';
   try{
    const r=await fetch('/.netlify/functions/admin-addresses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:requestController.signal});
    const b=await r.json().catch(()=>{throw new Error('Address lookup returned an unexpected response. Please enter the address manually and try again later.')});
    if(requestVersion!==version||!dialog.open)return;
    if(!r.ok)throw new Error(b.error||'Address suggestions unavailable. Please enter the address manually.');
    render(Array.isArray(b.suggestions)?b.suggestions:[]);
   }catch(e){
    if(requestVersion!==version)return;
    hide();status.textContent=timedOut?'Address lookup timed out. You can enter the address manually, or focus the street field to retry.':e.name==='AbortError'?'Address lookup cancelled. You can enter the address manually.':e instanceof TypeError?'Unable to reach address lookup. Check your connection or enter the address manually.':e.message||'Address suggestions unavailable. Please enter the address manually.';
   }finally{clearTimeout(timeout);if(requestVersion===version){loading=false;controller=null}}
  },350);
 }
 input.addEventListener('input',lookup);
 input.addEventListener('focus',()=>{if(input.value.trim().length>=3&&list.hidden)lookup()});
 input.addEventListener('keydown',e=>{if(e.key==='Escape'&&!list.hidden){e.preventDefault();e.stopPropagation();cancel();status.textContent=hint;return}if(list.hidden||!suggestions.length)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();highlight(active<0?(e.key==='ArrowDown'?0:suggestions.length-1):(active+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length)}else if(e.key==='Enter'){e.preventDefault();choose(active<0?0:active)}});
 input.addEventListener('blur',()=>{const wasLoading=loading;cancel();if(wasLoading)status.textContent='Address lookup cancelled. You can enter the address manually or return to the street field to retry.';else if(status.textContent.includes('address suggestions.'))status.textContent=hint});form.addEventListener('reset',()=>{cancel();status.textContent=hint});dialog.addEventListener('close',cancel);
})();

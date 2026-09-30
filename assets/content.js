(() => {
  const fallback={phone_display:'(306) 530-9239',phone_link:'+13065309239',address_line1:'40 Sandison Cres.',city:'Regina',province:'Saskatchewan',postal_code:'S4R 6R9',email:'test@reginafireworks.ca',products:[]};
  const themes={blue:'linear-gradient(140deg,#071b36,#164f9e)',sunset:'linear-gradient(140deg,#2a163e,#b46b35)',pink:'linear-gradient(140deg,#260a26,#ad2057)',amber:'linear-gradient(140deg,#221b08,#a34c0b)',violet:'linear-gradient(140deg,#17133f,#6e32a8)'};
  const categories=[['roman-candles-consumer-fireworks','Roman Candles'],['sound-shells','Sound shells'],['barrages-en','Barrages'],['maximum-load-mortars','Maximum load mortars'],['cakes-bombardos-consumer-fireworks','Multishots Cakes'],['angled-cakes','Angled Cakes'],['fireworks-kits','Fireworks Kits'],['ground-spinners','Ground Spinners'],['fountains','Fountains'],['sparklers-consumer-fireworks','Sparklers'],['miscellaneous','Miscellaneous']];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function loadData(){try{const r=await fetch('/data/site.json',{cache:'no-store'});if(!r.ok)throw 0;return {...fallback,...await r.json()}}catch{return fallback}}
  function applyContact(d){
    document.querySelectorAll('[data-contact-phone]').forEach(a=>{a.href=`tel:${d.phone_link}`;a.textContent=a.dataset.prefix?`${a.dataset.prefix}${d.phone_display}`:d.phone_display});
    document.querySelectorAll('[data-contact-email]').forEach(a=>{a.href=`mailto:${d.email}`;a.textContent=d.email});
    document.querySelectorAll('[data-contact-address]').forEach(e=>{e.innerHTML=`${esc(d.address_line1)}<br>${esc(d.city)}, ${esc(d.province)} ${esc(d.postal_code)}`});
    document.querySelectorAll('[data-contact-map]').forEach(a=>{a.href=`https://maps.google.com/?q=${encodeURIComponent(`${d.address_line1} ${d.city} ${d.province} ${d.postal_code}`)}`});
  }
  function renderProducts(d){
    const grid=document.getElementById('product-grid');if(!grid)return;
    const filters=document.getElementById('category-filters'),search=document.getElementById('product-search'),counter=document.getElementById('product-count'),more=document.getElementById('load-more');
    const products=(d.products||[]).filter(p=>p.active!==false);let active='all',query='',limit=18;
    const counts=Object.fromEntries(categories.map(([id])=>[id,products.filter(p=>p.category===id).length]));
    filters.innerHTML=`<button class="filter active" data-filter="all">All products (${products.length})</button>`+categories.filter(([id])=>counts[id]).map(([id,label])=>`<button class="filter" data-filter="${esc(id)}">${esc(label)} (${counts[id]})</button>`).join('');
    function draw(){
      const q=query.trim().toLowerCase();
      const matches=products.filter(p=>(active==='all'||p.category===active)&&(!q||[p.name,p.code,p.type,p.price].some(v=>String(v||'').toLowerCase().includes(q))));
      const shown=matches.slice(0,limit);
      grid.innerHTML=shown.map(p=>`<article class="product" data-category="${esc(p.category)}"><div class="burst ${p.image?'has-image':''}" style="--bg:${themes[p.theme]||themes.blue}">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)} product packaging" loading="lazy" width="800" height="800">`:''}</div><div class="product-body"><div class="meta"><span>${p.code?`Code ${esc(p.code)}`:'Featured'}</span><span>${esc(p.type)}</span></div><h3>${esc(p.name)}</h3>${p.details?`<p>${esc(p.details)}</p>`:''}<div class="price">${esc(p.price||'Call for price')}</div></div></article>`).join('')||'<p>No products match your search. Try another category or keyword.</p>';
      counter.textContent=`Showing ${shown.length} of ${matches.length} products`;
      more.hidden=shown.length>=matches.length;more.textContent=`Load more products (${matches.length-shown.length} remaining)`;
      if(!reduced)grid.querySelectorAll('.product').forEach((card,i)=>card.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'none'}],{duration:420,delay:Math.min(i,12)*28,easing:'cubic-bezier(.2,.75,.2,1)',fill:'both'}));
    }
    filters.addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;active=b.dataset.filter;limit=18;filters.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));draw()});
    search?.addEventListener('input',()=>{query=search.value;limit=18;draw()});
    more?.addEventListener('click',()=>{limit+=18;draw()});draw();
  }
  function setupPageTransitions(){
    const style=document.createElement('style');style.textContent='@view-transition{navigation:auto}body{transition:opacity .28s ease,transform .28s ease}body.page-before-enter{opacity:0;transform:translateY(8px)}body.page-leave{opacity:0;transform:translateY(-8px)}@media(prefers-reduced-motion:reduce){body{transition:none!important}}';document.head.appendChild(style);
    if(!reduced){document.body.classList.add('page-before-enter');requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove('page-before-enter')))}
    document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a||e.defaultPrevented||e.button>0||e.metaKey||e.ctrlKey||e.shiftKey||a.target==='_blank'||a.hasAttribute('download'))return;const href=a.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('tel:')||href.startsWith('mailto:'))return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.pathname===location.pathname)return;if(reduced)return;e.preventDefault();document.body.classList.add('page-leave');setTimeout(()=>location.href=u.href,220)});
    addEventListener('pageshow',()=>document.body.classList.remove('page-leave'));
  }
  function setupUI(){
    const menu=document.querySelector('.menu'),links=document.querySelector('.navlinks');
    if(menu&&links){menu.addEventListener('click',()=>{const o=links.classList.toggle('open');menu.setAttribute('aria-expanded',o)});links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')))}
    document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());
    const els=document.querySelectorAll('.reveal');if(reduced)els.forEach(e=>e.classList.add('in-view'));else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target)}}),{threshold:.12});els.forEach(e=>io.observe(e))}
    const header=document.querySelector('.header'),hero=document.querySelector('.hero');let ticking=false;
    addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{header?.classList.toggle('scrolled',scrollY>80);if(hero&&!reduced&&scrollY<hero.offsetHeight)hero.style.setProperty('--hero-y',`${Math.min(scrollY*.11,58)}px`);ticking=false})},{passive:true});
  }
  setupPageTransitions();setupUI();loadData().then(d=>{applyContact(d);renderProducts(d);window.siteData=d});
})();

(() => {
  const fallback = {
    phone_display: '(306) 530-9239', phone_link: '+13065309239',
    address_line1: '40 Sandison Cres.', city: 'Regina', province: 'Saskatchewan', postal_code: 'S4R 6R9',
    email: 'test@reginafireworks.ca', products: []
  };
  const themes={blue:'linear-gradient(140deg,#071b36,#164f9e)',sunset:'linear-gradient(140deg,#2a163e,#b46b35)',pink:'linear-gradient(140deg,#260a26,#ad2057)',amber:'linear-gradient(140deg,#221b08,#a34c0b)',violet:'linear-gradient(140deg,#17133f,#6e32a8)'};
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
    const products=(d.products||[]).filter(p=>p.active!==false);
    grid.innerHTML=products.map(p=>`<article class="product reveal in-view" data-category="${esc(p.category||'other')}"><div class="burst" style="--bg:${themes[p.theme]||themes.blue}"></div><div class="product-body"><div class="meta"><span>${p.code?`Code ${esc(p.code)}`:'Featured'}</span><span>${esc(p.type)}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.details)}</p><div class="price">${esc(p.price)}</div></div></article>`).join('')||'<p>No products are currently listed. Please call for availability.</p>';
    const runFilter=f=>grid.querySelectorAll('.product').forEach(p=>p.hidden=f!=='all'&&p.dataset.category!==f);
    document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');runFilter(b.dataset.filter)}));
  }
  function setupUI(){
    const menu=document.querySelector('.menu'),links=document.querySelector('.navlinks');
    if(menu&&links){menu.addEventListener('click',()=>{const o=links.classList.toggle('open');menu.setAttribute('aria-expanded',o)});links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')))}
    document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,els=document.querySelectorAll('.reveal');
    if(reduced)els.forEach(e=>e.classList.add('in-view'));else{const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target)}}),{threshold:.12});els.forEach(e=>io.observe(e))}
    const header=document.querySelector('.header'),hero=document.querySelector('.hero');let ticking=false;
    addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{header?.classList.toggle('scrolled',scrollY>80);if(hero&&!reduced&&scrollY<hero.offsetHeight)hero.style.setProperty('--hero-y',`${Math.min(scrollY*.11,58)}px`);ticking=false})},{passive:true});
  }
  setupUI();loadData().then(d=>{applyContact(d);renderProducts(d);window.siteData=d});
})();

(() => {
 const motion=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const native='onpageswap' in window&&'onpagereveal' in window;
 const publicPath=p=>['/','/index.html','/products/','/products','/products.html','/safety/','/safety','/safety.html'].includes(p);
 let leaving=false,exit,entry,recovery;
 function restore(){clearTimeout(recovery);leaving=false;exit?.cancel();exit=null}
 function enter(){restore();entry?.cancel();if(document.documentElement.classList.contains('home-page')||!motion()||native||typeof document.body.animate!=='function')return;entry=document.body.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});entry.finished.then(()=>{entry=null}).catch(()=>{})}
 // Native navigation is left entirely to the browser: no duplicate JS animation.
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
  const url=new URL(a.href,location.href);if(url.origin!==location.origin||!publicPath(url.pathname)||url.pathname===location.pathname||!motion()||native||typeof document.body.animate!=='function')return;
  e.preventDefault();if(leaving)return;leaving=true;entry?.cancel();exit=document.body.animate([{opacity:1},{opacity:0}],{duration:170,easing:'ease-in',fill:'forwards'});
  exit.finished.then(()=>{location.assign(url.href);recovery=setTimeout(restore,2000)}).catch(restore);
 });
 addEventListener('pagereveal',e=>{if(e.viewTransition&&document.documentElement.classList.contains('home-page'))document.documentElement.classList.add('home-native-navigation')});
 addEventListener('pageshow',e=>{restore();if(e.persisted)enter()});
 addEventListener('pagehide',()=>{clearTimeout(recovery)});
 enter();
})();

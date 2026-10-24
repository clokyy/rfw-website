const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.RFW_TEST_URL||'http://127.0.0.1:8766';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.cspErrors=[];document.addEventListener('securitypolicyviolation',e=>cspErrors.push(e.violatedDirective))});
  for(const path of ['/','/products/','/safety/','/admin/']){
   if(path==='/admin/')await page.route('**/.netlify/functions/admin-auth',route=>route.fulfill({json:{authenticated:false}}));
   const response=await page.goto(base+path),headers=response.headers();assert.equal(response.status(),200);assert.match(headers['content-security-policy'],/script-src 'self'/);assert.equal(headers['x-content-type-options'],'nosniff');assert.match(headers['strict-transport-security'],/max-age=31536000/);assert.equal(headers['x-frame-options'],'DENY');await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>cspErrors),[]);assert.equal(await page.locator('style,script:not([src])').count(),0);
  }
  for(const path of ['/data/admin-users.enc.json','/data/security.enc.json','/data/invoices/','/netlify/functions/_lib.cjs','/tests/','/package.json'])assert.equal((await page.request.get(base+path)).status(),404,path);
  assert.equal((await page.request.get(base+'/data/site.json')).status(),200);assert.deepEqual(errors,[]);
  console.log('Public-page CSP, HTTPS/security headers, private-file 404s and public catalogue availability passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

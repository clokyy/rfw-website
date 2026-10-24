const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),cp=require('node:child_process');
const {chromium}=require('playwright');
process.env.SESSION_SECRET='test-only-remember-browser-ui-root';process.env.ADMIN_USERNAME='owner';process.env.ADMIN_PASSWORD='test-only-owner-password';process.env.GITHUB_TOKEN='test-only';
const root=path.resolve(__dirname,'..'),site=JSON.parse(fs.readFileSync(path.join(root,'data/site.json'))),storage=require('./fixtures/admin-storage.cjs')(site),security=storage.security;
const mfa=require('../netlify/functions/lib/mfa.cjs'),devices=require('../netlify/functions/lib/devices.cjs');
const recovery='UI-TEST-RECOVERY-ONE';security.seed(undefined,{lastStep:-1,recovery:[mfa.recoveryHash(recovery)]});
const handlers=Object.fromEntries(['admin-auth','admin-mfa','admin-users','admin-data','admin-invoices'].map(n=>[n,require('../netlify/functions/'+n+'.cjs').handler]));
const requests=[];
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rfw-browser-tls-'));let browser,server;
 try{
  cp.execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(temp,'key.pem'),'-out',path.join(temp,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
  const headerConfig=JSON.parse(cp.execFileSync('python3',['-c',"import json,tomllib; print(json.dumps(tomllib.load(open('netlify.toml','rb'))['headers']))"],{cwd:root,encoding:'utf8'}));
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
  server=https.createServer({key:fs.readFileSync(path.join(temp,'key.pem')),cert:fs.readFileSync(path.join(temp,'cert.pem'))},async(req,res)=>{
   try{
    const url=new URL(req.url,'https://'+req.headers.host),name=url.pathname.split('/').pop();
    if(url.pathname.startsWith('/.netlify/functions/')){
     requests.push({name,method:req.method});let body='';for await(const part of req)body+=part;
     const response=handlers[name]?await handlers[name]({httpMethod:req.method,headers:req.headers,rawUrl:url.href,body,queryStringParameters:Object.fromEntries(url.searchParams)}):{statusCode:404,headers:{},body:'{}'};
     res.writeHead(response.statusCode,{...response.headers,...response.multiValueHeaders});res.end(response.body);return;
    }
    let file=path.resolve(root,'public','.'+url.pathname);if(!file.startsWith(path.join(root,'public')+path.sep)&&file!==path.join(root,'public')){res.writeHead(404);res.end();return}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    const headers={};for(const item of headerConfig)if(item.for==='/*'||(item.for==='/admin/*'&&url.pathname.startsWith('/admin/')))Object.assign(headers,item.values);
    if(!fs.existsSync(file)){res.writeHead(404,headers);res.end();return}
    res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
   }catch{res.writeHead(500);res.end('Test server error')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='https://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.cspErrors=[];document.addEventListener('securitypolicyviolation',e=>cspErrors.push(e.violatedDirective))});
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const signIn=async()=>{await page.locator('#login-view').waitFor({state:'visible'});await page.fill('#login-form [name=username]','owner');await page.fill('#login-form [name=password]',process.env.ADMIN_PASSWORD);await page.click('#login-form button[type=submit]')};
  const trust=async()=>(await context.cookies()).find(c=>c.name===devices.COOKIE);
  await page.goto(base+'/admin/');await signIn();await page.locator('#mfa-code-form').waitFor({state:'visible'});assert.equal(await page.isChecked('#mfa-remember'),false);assert.equal(await trust(),undefined);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.check('#mfa-remember');await page.fill('#mfa-code',mfa.totp(security.record().secret));await page.click('#mfa-verify');await page.locator('#dashboard').waitFor({state:'visible'});
  const first=await trust();assert(first);assert.equal(first.httpOnly,true);assert.equal(first.secure,true);assert.equal(first.sameSite,'Strict');assert(Math.abs(first.expires-Date.now()/1000-2592000)<3);assert(!(await page.evaluate(()=>document.cookie)).includes(devices.COOKIE));
  assert(!JSON.stringify(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).includes(first.value));
  await page.click('#logout');await page.locator('#login-view').waitFor({state:'visible'});assert.equal((await trust()).value,first.value);const callsBefore=requests.filter(r=>r.name==='admin-mfa').length;
  await signIn();await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await page.isVisible('#mfa-view'),false);assert.equal(requests.filter(r=>r.name==='admin-mfa').length,callsBefore);
  const rotated=await trust();assert.notEqual(rotated.value,first.value);assert(rotated.expires<=first.expires);await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});
  // Cancelling the confirmation leaves the browser trusted; accepting revokes it and its derived session.
  page.once('dialog',dialog=>dialog.dismiss());await page.click('#forget-devices');assert.equal((await trust()).value,rotated.value);
  page.once('dialog',dialog=>dialog.accept());await page.click('#forget-devices');await page.locator('#login-view').waitFor({state:'visible'});assert.equal(await trust(),undefined);assert.equal(security.record().devices.length,0);
  await signIn();await page.locator('#mfa-code-form').waitFor({state:'visible'});assert.equal(await page.isChecked('#mfa-remember'),false);
  await page.fill('#mfa-code',recovery);await page.click('#mfa-verify');await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await trust(),undefined);
  await page.click('#logout');await page.locator('#login-view').waitFor({state:'visible'});await signIn();await page.locator('#mfa-code-form').waitFor({state:'visible'});assert.equal(await page.isChecked('#mfa-remember'),false);
  await page.check('#mfa-remember');await page.fill('#mfa-code','invalid');await page.click('#mfa-verify');await page.waitForFunction(()=>document.querySelector('#mfa-error').textContent.includes('Invalid'));assert.equal(await trust(),undefined);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>cspErrors),[]);
  console.log('Remembered-browser HTTPS UI passed: unchecked default, real Secure/HttpOnly cookies, MFA opt-in, password login without repeat MFA, token rotation, logout persistence, confirmation/revocation, opt-out, failed verification, mobile layout and CSP');
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

const {spawn,spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base=process.env.RFW_TEST_URL||'http://127.0.0.1:8766';
(async()=>{
 let server;
 try{
  if(!process.env.RFW_TEST_URL){
   const build=spawnSync(process.execPath,['scripts/build.cjs'],{cwd:root,stdio:'inherit'});if(build.status)throw Error('Build failed');
   server=spawn('python3',['tests/server.py','8766'],{cwd:root,stdio:'ignore'});server.on('error',()=>{});
   let ready=false;for(let i=0;i<30;i++){try{ready=(await fetch(base+'/')).ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,200))}
   if(!ready||server.exitCode!==null)throw Error('Test server could not start; set RFW_TEST_URL to an existing local test server');
  }
  for(const name of ['public-pages','admin-onboarding-ui','remember-devices-ui','invoice-management','labels','scanning','camera-scanning']){
   const result=spawnSync(process.execPath,['tests/'+name+'.cjs'],{cwd:root,stdio:'inherit',env:{...process.env,RFW_TEST_URL:base}});
   if(result.status!==0)throw Error(name+' failed');
  }
 }finally{server?.kill()}
})().catch(e=>{console.error(e.message);process.exitCode=1});

// Cloud Chromium may lack the CA already configured for Node/system HTTPS.
// Opt in to verified API transport; retain proxy, hostname checks and headers.
// This changes no OS/browser trust store and never ignores TLS errors.
const {request}=require('playwright');
module.exports=async page=>{
  if(process.env.TABLETOP_PROXY_TLS!=='1')return {transport:'native browser HTTPS',dispose:async()=>{}};
  const inherited=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
  if(!inherited)throw new Error('Verified proxy transport requires the inherited HTTPS/HTTP proxy');
  const parsed=new URL(inherited),proxy={server:parsed.origin};
  if(parsed.username)proxy.username=decodeURIComponent(parsed.username);
  if(parsed.password)proxy.password=decodeURIComponent(parsed.password);
  const api=await request.newContext({proxy,ignoreHTTPSErrors:false});
  await page.route('https://**/*',async route=>{
    const response=await api.fetch(route.request(),{timeout:60000});
    await route.fulfill({response});
  });
  return {transport:'HTTPS API through inherited proxy, TLS verification enabled with configured system/Node CA',dispose:()=>api.dispose()};
};

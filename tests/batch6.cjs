const {chooseField}=require('./ui-helpers.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:[...JSON.parse(process.env.CHROMIUM_ARGS||'[]'),'--no-sandbox','--enable-unsafe-swiftshader','--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessForNavigations,LocalNetworkAccessForWorkers']});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[],report={};
 const assetRoot=path.resolve(__dirname,'../public'),url='http://127.0.0.1:8765/';page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 const readEmoji=()=>page.locator('#balanceEmoji').getAttribute('data-emoji');
 const resetSettings=()=>page.evaluate(()=>{state.balanceEmoji=structuredClone(BALANCE_EMOJI_DEFAULTS)});
 const setAbsolute=async balance=>page.evaluate(amount=>{const cents=Math.round(Math.abs(amount)*100);persist({...state,budgets:{total:null,categories:{}},entries:cents?[{id:'balance',type:amount>=0?'income':'expense',category:amount>=0?'工资':'吃饭',sub:'',cents,date:'2020-01-01',created:1,note:'测试余额'}]:[]});render()},balance);
 const setRemaining=async percent=>page.evaluate(remaining=>{
  const spent=Math.round(10000-remaining*100),date=localDate(new Date());
  const row=(id,type,category,cents)=>({id,type,category,sub:'',cents,date,created:1,note:id});
  const entries=[row('income','income','工资',100000),row('transfer','expense','转账',999999),row('savings','expense','储蓄',999999),row('refund','income','退款',1000)];
  if(spent)entries.push(row('spent','expense','吃饭',spent));persist({...state,monthStartDay:5,budgets:{total:10000,categories:{}},entries});render();
 },percent);
 const selectMode=async mode=>{await page.locator('#chooseEmojiMode').click();await page.locator('#recordChoiceRows [data-value="'+mode+'"]').click()};
 const fillTriplet=async(prefix,values)=>{for(let i=0;i<3;i++)await page.locator('#'+prefix+i).fill(String(values[i]))};
 const restore=async data=>{await page.locator('#restoreFile').setInputFiles({name:'emoji-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>$('#toast').textContent==='账本已恢复')};
 try{
  const cdp=await context.newCDPSession(page);await cdp.send('Browser.setPermission',{permission:{name:'local-network-access'},setting:'granted'});
  await page.route(url+'**',async route=>{
   const requestUrl=new URL(route.request().url()),file=path.join(assetRoot,requestUrl.pathname==='/'?'index.html':requestUrl.pathname),ext=path.extname(file);
   if(!file.startsWith(assetRoot+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
   await route.fulfill({status:200,body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.gif':'image/gif','.webmanifest':'application/manifest+json'})[ext]||'application/octet-stream'});
  });
  await page.clock.install({time:new Date('2026-11-11T12:00:00+08:00')});await page.goto(url);await page.waitForFunction(()=>$('#offlineStatus').dataset.ready==='true');
  report.cache=await page.evaluate(async()=>{const status=await offlineProbe(),cache=await caches.open(status.version);return {...status,zipCached:!!await cache.match('./assets/budget-emojis/emoji-pack.zip'),emojiFiles:(await cache.keys()).filter(r=>r.url.includes('/budget-emojis/')).length}});
  assert.equal(report.cache.version,'lanyu-shell-v34');assert.equal(report.cache.total,62);assert.equal(report.cache.ready,true);assert.equal(report.cache.emojiFiles,4);assert.equal(report.cache.zipCached,false);assert.equal(await page.locator('#offlineProgress').getAttribute('max'),'62');
  await page.unroute(url+'**');await context.setOffline(true);await page.reload();await page.waitForFunction(()=>$('#offlineStatus').dataset.ready==='true');report.offline=true;
  await resetSettings();report.budgetBoundaries=[];
  for(const [remaining,expected]of [[100,'happy'],[50,'happy'],[49.99,'nervous'],[20,'nervous'],[19.99,'anxious'],[5,'anxious'],[4.99,'crying'],[0,'crying'],[-10,'crying']]){await setRemaining(remaining);assert.equal(await readEmoji(),expected,'budget remaining '+remaining);report.budgetBoundaries.push({remaining,expected})}
  await setRemaining(50);await page.locator('[data-key="1"]').click();await page.locator('#saveEntry').click();assert.equal(await readEmoji(),'nervous');await page.locator('#openRecords').click();await page.locator('#records .row .delete-record').first().click();assert.equal(await readEmoji(),'happy');await page.locator('#recordsDialog [data-close]').click();
  await page.locator('#openSettings').click();await page.locator('[data-setting=planning] summary').click();await page.locator('#openBudgets').click();await chooseField(page,'budgetTarget','');await page.locator('#budgetAmount').fill('60');await page.locator('#budgetForm [type=submit]').click();assert.equal(await readEmoji(),'anxious');await page.locator('#budgetDialog [data-close]').click();await page.locator('#settings [data-close]').click();report.liveUpdates={add:true,delete:true,budget:true};
  report.absoluteBoundaries=[];
  for(const mode of ['budget','absolute']){
   await page.evaluate(mode=>{state.balanceEmoji={...structuredClone(BALANCE_EMOJI_DEFAULTS),mode}},mode);
   for(const [balance,expected]of [[1000,'happy'],[999.99,'nervous'],[500,'nervous'],[499.99,'anxious'],[200,'anxious'],[199.99,'crying'],[0,'crying'],[-0.01,'crying'],[-1234.56,'crying']]){await setAbsolute(balance);assert.equal(await readEmoji(),expected,mode+' amount '+balance);report.absoluteBoundaries.push({mode,balance,expected})}
  }
  await page.evaluate(()=>{state.balanceEmoji={...structuredClone(BALANCE_EMOJI_DEFAULTS),mode:'absolute'};persist({...state,budgets:{total:10000,categories:{}},entries:[{id:'in',created:1,type:'income',category:'工资',sub:'',date:today,cents:111000,note:''},{id:'out',created:2,type:'expense',category:'吃饭',sub:'',date:today,cents:11000,note:''}]});render()});assert.equal(await readEmoji(),'happy');report.absoluteIgnoresBudget=true;
  await resetSettings();await setRemaining(55);await page.locator('#openSettings').click();await page.locator('[data-setting=appearance] summary').click();await fillTriplet('emojiPercent',[60,30,10]);await page.locator('#saveEmojiSettings').click();assert.equal(await readEmoji(),'nervous');
  const unchanged=await page.evaluate(()=>JSON.stringify(state.balanceEmoji));
  for(const invalid of [[100,20,5],[50,0,5],[20,50,5],[50,50,5]]){await fillTriplet('emojiPercent',invalid);await page.locator('#saveEmojiSettings').click();assert.equal(await page.evaluate(()=>JSON.stringify(state.balanceEmoji)),unchanged);assert.ok(await page.locator('#emojiSettingsError').textContent())}
  await fillTriplet('emojiPercent',[60,30,10]);await setAbsolute(450);await selectMode('absolute');await fillTriplet('emojiAmount',[800,400,100]);await page.locator('#saveEmojiSettings').click();assert.equal(await readEmoji(),'nervous');
  const absoluteUnchanged=await page.evaluate(()=>JSON.stringify(state.balanceEmoji));
  for(const invalid of [[-1,400,100],[800,400,400],[100,400,800]]){await fillTriplet('emojiAmount',invalid);await page.locator('#saveEmojiSettings').click();assert.equal(await page.evaluate(()=>JSON.stringify(state.balanceEmoji)),absoluteUnchanged);assert.ok(await page.locator('#emojiSettingsError').textContent())}
  await fillTriplet('emojiAmount',[800,400,0]);await page.locator('#saveEmojiSettings').click();await setAbsolute(0);assert.equal(await readEmoji(),'anxious');
  await fillTriplet('emojiAmount',[800,400,100]);await page.locator('#saveEmojiSettings').click();await setAbsolute(450);report.settings={percentImmediate:true,amountImmediate:true,zeroAmountThreshold:true,invalidPercentRejected:4,invalidAmountRejected:3};
  await page.locator('[data-setting=backup] summary').click();const downloadPromise=page.waitForEvent('download');await page.locator('#backupJson').click();const download=await downloadPromise,exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.deepEqual(exported.balanceEmoji,{mode:'absolute',percent:[60,30,10],amountCents:[80000,40000,10000]});const originalEntries=structuredClone(exported.entries),legacy=structuredClone(exported);delete legacy.balanceEmoji;
  await restore(legacy);assert.deepEqual(await page.evaluate(()=>balanceEmojiSettings()),{mode:'budget',percent:[50,20,5],amountCents:[100000,50000,20000]});assert.deepEqual(await page.evaluate(()=>state.entries),originalEntries);
  await restore(exported);assert.deepEqual(await page.evaluate(()=>state.balanceEmoji),exported.balanceEmoji);assert.deepEqual(await page.evaluate(()=>state.entries),originalEntries);report.backup={jsonRoundTrip:true,legacyDefaults:true,entriesPreserved:true};
  await page.locator('#settings [data-close]').click();await resetSettings();report.pngOfflineDecoded=[];
  for(const balance of [2000,750,300,100]){await setAbsolute(balance);await page.waitForFunction(()=>$('#balanceEmoji').getAttribute('src').endsWith('.png'));await page.locator('#balanceEmoji').evaluate(image=>image.decode());assert.equal(await page.locator('#balanceEmoji').evaluate(image=>image.naturalWidth),512);report.pngOfflineDecoded.push(await readEmoji())}
  await setAbsolute(2000);assert.equal(await page.locator('#balanceEmoji').getAttribute('aria-label'),'余额状态：开心');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>$('#balanceEmoji').getAttribute('src').endsWith('.png'));await page.locator('#balanceEmoji').evaluate(image=>image.decode());await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>$('#balanceEmoji').getAttribute('src').endsWith('.png'));report.reducedMotion=true;
  report.viewports=[];
  for(const [width,height]of [[320,568],[375,667],[390,844]]){
   await page.setViewportSize({width,height});for(const balance of [-1234.56,123456.78]){
    await setAbsolute(balance);const box=await page.evaluate(()=>{const icon=$('#balanceEmoji').getBoundingClientRect(),actions=$('.balance-actions').getBoundingClientRect(),number=$('#balance'),save=$('#saveEntry').getBoundingClientRect();return {width:innerWidth,height:innerHeight,iconWidth:icon.width,iconHeight:icon.height,numberVisible:number.scrollWidth<=number.clientWidth+1,headerClear:icon.right<=actions.left,saveVisible:save.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth||$('.app').scrollHeight>$('.app').clientHeight+1,balance:number.textContent}});
    assert.equal(box.iconWidth,32);assert.equal(box.iconHeight,32);assert.ok(box.numberVisible&&box.headerClear&&box.saveVisible&&!box.overflow,JSON.stringify(box));report.viewports.push(box);
   }
  }
  if(process.env.ARTIFACT_DIR){await page.evaluate(()=>{$('#toast').hidden=true;document.activeElement?.blur()});await page.waitForTimeout(250);await page.screenshot({path:path.join(process.env.ARTIFACT_DIR,'余额表情3.5-首页.png')})}
  report.staticAssetsOnly=await page.evaluate(async()=>{const c=await caches.open('lanyu-shell-v34');return !(await c.keys()).some(request=>request.url.endsWith('.gif'))});assert.equal(report.staticAssetsOnly,true);
  assert.deepEqual(errors,[]);report.errors=errors;if(process.env.REPORT_PATH)fs.writeFileSync(process.env.REPORT_PATH,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});

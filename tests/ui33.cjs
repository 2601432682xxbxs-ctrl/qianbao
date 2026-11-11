const {chooseField,setDateField}=require('./ui-helpers.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],report={};page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.clock.install({time:new Date(2026,10,15,21,5)});
  await page.goto(process.env.APP_TEST_URL||'http://127.0.0.1:8765/');await page.waitForFunction(()=>document.querySelector('#offlineStatus').dataset.ready==='true');
  assert.equal(await page.evaluate(()=>(offlineProbe()).then(r=>r.total)),62);
  await page.locator('#openSettings').click();assert.equal(await page.locator('#settings .settings-group').count(),7);assert.equal(await page.locator('#settings .settings-group[open]').count(),0);
  const before=await page.locator('#settings').boundingBox();await page.locator('#settings details').evaluateAll(rows=>rows.forEach(d=>d.open=true));const after=await page.locator('#settings').boundingBox();assert.equal(after.height,before.height);assert.equal(after.y,before.y);assert.ok(await page.locator('.settings-scroll').evaluate(e=>e.scrollHeight>e.clientHeight));await page.locator('#settings [data-close]').click();report.settings={groups:7,fixedOnExpansion:true};
  await page.locator('#quickBudget').click();assert.ok(await page.locator('#budgetDialog').isVisible());await page.locator('#budgetDialog [data-close]').click();
  await page.locator('#openRecords').click();await page.locator('#chooseRecordType').click();await page.locator('#recordChoiceRows [data-value=expense]').click();assert.equal(await page.evaluate(()=>$('#recordType').value),'expense');
  await page.locator('#chooseRecordStart').click();await page.locator('#recordCalendarDays [data-date="2026-11-15"]').click();assert.equal(await page.evaluate(()=>$('#recordStart').value),'');await page.locator('#recordDateDialog [data-close]').click();assert.equal(await page.evaluate(()=>$('#recordStart').value),'');
  await page.locator('#chooseRecordStart').click();await page.locator('#recordCalendarDays [data-date="2026-11-15"]').click();await page.locator('#confirmRecordDate').click();assert.equal(await page.locator('#chooseRecordStart span').textContent(),'2026-11-15');
  await page.evaluate(()=>applyFilter({recordStart:'2026-11-01',recordEnd:'2026-11-30',recordType:'income',recordCategory:'工资'}));assert.equal(await page.locator('#chooseRecordStart span').textContent(),'2026-11-01');assert.equal(await page.locator('#chooseRecordEnd span').textContent(),'2026-11-30');assert.equal(await page.locator('#chooseRecordType span').textContent(),'收入');assert.equal(await page.locator('#chooseRecordCategory span').textContent(),'工资');await page.locator('#recordsDialog [data-close]').click();report.filters={verticalChoices:true,dateDraftAndCancel:true,confirmedDate:true,savedFilterLabelsSync:true};
  report.viewports=[];
  for(const [width,height]of [[320,568],[375,667],[390,844]]){
   await page.setViewportSize({width,height});
   const ids=await page.locator('dialog').evaluateAll(rows=>rows.map(d=>d.id));let expected;
   for(const id of ids){await page.evaluate(id=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.getElementById(id).showModal()},id);const bounds=await page.locator('#'+id).boundingBox();expected??=bounds;assert.equal(bounds.height,expected.height,id);assert.equal(bounds.y,expected.y,id);assert.ok(await page.locator('#'+id).evaluate(d=>d.scrollWidth<=d.clientWidth+1),id);assert.ok(await page.locator('#'+id+' [data-close]').isVisible(),id)}
   await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());persist({...state,entries:[{id:'old',type:'income',category:'工资',sub:'',cents:123456,created:1,date:'2020-01-01',note:''}],eveningReminder:{enabled:true,dismissed:''}});render()});
   assert.ok(await page.locator('#eveningNotice').isVisible());assert.ok(await page.locator('.balance-value strong').isVisible());const home=await page.evaluate(()=>({bottom:$('#saveEntry').getBoundingClientRect().bottom,height:innerHeight,overflow:$('.app').scrollHeight>$('.app').clientHeight+1||document.documentElement.scrollWidth>innerWidth}));assert.ok(!home.overflow&&home.bottom<=height,JSON.stringify(home));report.viewports.push({width,height,dialogs:ids.length,fixedSize:true,balanceAndReminderVisible:true,singleScreen:true});
  }
  if(process.env.SHOT_DIR){await page.screenshot({path:process.env.SHOT_DIR+'/融合3.3-首页.jpg'});await page.locator('#openSettings').click();await page.locator('#settings details').evaluateAll(rows=>rows.forEach(d=>d.open=false));await page.screenshot({path:process.env.SHOT_DIR+'/融合3.3-设置.jpg'});await page.locator('#settings [data-close]').click();await page.locator('#openSummary').click();await page.locator('#openCalendar').click();await page.screenshot({path:process.env.SHOT_DIR+'/融合3.3-账单日历.jpg'})}
  assert.deepEqual(errors,[]);report.errors=errors;if(process.env.REPORT_PATH)fs.writeFileSync(process.env.REPORT_PATH,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

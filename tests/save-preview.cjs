// Run with Playwright available: node tests/save-preview.cjs
// Start the app first (npm start). Override TEST_URL / CHROMIUM_PATH if needed.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const url=process.env.TEST_URL || 'http://127.0.0.1:3000';
  for (const allowStorage of [true,false]) {
   const context=await browser.newContext({viewport:{width:1440,height:1200}});
   await context.route('**/cloud-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.FINANCE_CLOUD_CONFIG={};'}));const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('.stats').waitFor();
   await page.setContent(`<iframe sandbox="allow-scripts${allowStorage?' allow-same-origin':''}" src="${url}" style="width:100%;height:1000px"></iframe>`,{waitUntil:'domcontentloaded'});
   const frame=page.frameLocator('iframe');await frame.locator('#new-entry').click();
   await frame.locator('#save-entry').click();await assertVisibleError(frame,'#entry-form');
   await frame.locator('[name=description]').fill('Mercado teste na prévia');await frame.locator('[name=amount]').fill('300');await frame.locator('#save-entry').click();
   if(!allowStorage){await page.waitForFunction(()=>true);await frame.locator('#entry-form .form-error').filter({hasText:'bloqueou o armazenamento'}).waitFor();assert.equal(await frame.locator('#entry-dialog').evaluate(e=>e.open),true);}
   else {
    await frame.locator('#entry-dialog').waitFor({state:'hidden'});
    await frame.getByText('Mercado teste na prévia',{exact:true}).waitFor();
    const child=page.frames().find(f=>f!==page.mainFrame());
    assert.equal(await child.evaluate(()=>JSON.parse(localStorage.getItem('meu-saldo-v1')).entries.length),1);
    await child.evaluate(()=>location.reload());await frame.locator('.stats').waitFor();await frame.locator('[data-tab=transactions]').click();await frame.getByText('Mercado teste na prévia',{exact:true}).waitFor();
    await frame.locator('[data-tab=cards]').click();await frame.locator('#add-card').click();
    for(const [name,value]of Object.entries({name:'Cartão teste',digits:'1234',limit:'1000',closing:'10',due:'20'}))await frame.locator(`[name=${name}]`).fill(value);
    await frame.locator('#save-card').click();await frame.locator('#card-dialog').waitFor({state:'hidden'});await frame.getByText('Cartão teste',{exact:true}).waitFor();
    await frame.locator('#new-entry').click();await frame.locator('[name=description]').fill('Entrada pelo teclado');await frame.locator('[name=amount]').fill('50');await frame.locator('[name=description]').press('Enter');await frame.locator('#entry-dialog').waitFor({state:'hidden'});await frame.getByText('Entrada pelo teclado',{exact:true}).waitFor();
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: preview without allow-forms saves entries/cards; reload persists; Enter saves; validation and blocked-storage errors visible.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
async function assertVisibleError(frame,form){await frame.locator(form+' .form-error').filter({hasText:'Confira'}).waitFor();}

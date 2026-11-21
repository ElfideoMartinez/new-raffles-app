const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:4179';

test('platform preview → winner and optional method → draw receipt',async t=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN}); t.after(()=>browser.close());
 for(const width of [360,1024]) await t.test(`${width}px`,async()=>{
  const page=await browser.newPage({viewport:{width,height:850}});
  try{
   const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET'||new URL(r.url()).origin!==origin)requests.push(r.url())});
   assert.equal((await page.goto(origin+'/')).status(),200);
   await page.getByRole('link',{name:'Ver pelea de prueba'}).click();await page.waitForURL('**/ufc-preview/');
   const b=name=>page.getByRole('button',{name,exact:true});const cart=b('Agregar al carrito');
   await b('Elegir Alex Rivera').waitFor();assert.equal(await cart.isDisabled(),true);
   await b('Elegir Alex Rivera').click();await b('Agregar método · +$20').click();assert.equal(await cart.isDisabled(),true);
   await b('KO/TKO').click();await b('Elegir Nico Santos').click();assert.equal(await page.getByTestId('stake').innerText(),'$50');
   await b('Agregar método · +$20').click();await b('Sumisión').click();assert.equal(await page.getByTestId('stake').innerText(),'$70');
   await cart.click();assert.deepEqual(await page.getByTestId('cart-lines').locator('li').allTextContents(),['Ganador · Nico Santos$50','Método · Nico Santos por Sumisión$20']);
   await b('Simular empate oficial').click();await page.getByText('Reembolso pendiente',{exact:true}).waitFor();assert.equal(await page.getByTestId('refund').innerText(),'$70');
   await b('Simular transferencia confirmada').click();await page.getByText('Reembolsado',{exact:true}).waitFor();
   await b('Volver a probar').click();await b('Elegir Alex Rivera').click();await b('Agregar método · +$20').click();await b('Decisión').click();await b('Quitar método').click();await cart.click();await b('Simular empate oficial').click();assert.equal(await page.getByTestId('refund').innerText(),'$50');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
   assert.equal((await page.goto(origin+'/ufc-preview/')).status(),200);
  }finally{await page.close()}
 });
});

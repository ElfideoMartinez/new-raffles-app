const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.env.CHECKOUT_URL || pathToFileURL(join(__dirname,'checkout-preview.html')).href;

test('UFC demo checkout and draw, desktop and mobile', async t=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined});
 t.after(()=>browser.close());
 for(const width of [1000,360]){
  await t.test(`${width}px`,async()=>{
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const failures=[],badRequests=[];page.on('pageerror',e=>failures.push(e.message));
    page.on('request',r=>{if(r.method()!=='GET'||new URL(r.url()).origin!==new URL(url).origin)badRequests.push(r.url());});
    const response=await page.goto(url);if(response)assert.equal(response.status(),200);
    const button=name=>page.getByRole('button',{name,exact:true});
    assert.equal(await button('Agregar al carrito').isDisabled(),true);
    await button('Elegir Alex Rivera').click();
    await button('Agregar método · +$20').click();
    await button('KO/TKO').click();
    assert.equal(await page.locator('#total').innerText(),'$70.00 MXN');
    await button('Elegir Nico Santos').click();
    assert.equal(await page.locator('#total').innerText(),'$50.00 MXN','a fighter switch clears the extra');
    await button('Agregar método · +$20').click();await button('Sumisión').click();
    await button('Agregar al carrito').click();
    assert.deepEqual(await page.locator('#cart-lines li').allTextContents(),['Ganador · Nico Santos$50.00 MXN','Método · Nico Santos por Sumisión$20.00 MXN']);
    await button('Editar selección').click();await button('Quitar método').click();await button('Agregar al carrito').click();
    assert.deepEqual(await page.locator('#cart-lines li').allTextContents(),['Ganador · Nico Santos$50.00 MXN']);
    await button('Editar selección').click();await button('Agregar método · +$20').click();
    assert.equal(await button('Agregar al carrito').isDisabled(),true,'extra opened but no method chosen');
    await button('Decisión').click();await button('Agregar al carrito').click();
    await button('Simular empate oficial').click();
    assert.match(await page.locator('#refund').innerText(),/Reembolso pendiente/);
    assert.equal(await page.locator('#refund-total').innerText(),'$70.00 MXN');
    assert.equal(await page.locator('#refund-lines li').count(),2);
    await button('Simular transferencia confirmada').click();
    assert.match(await page.locator('#refund').innerText(),/Reembolsado/);
    await button('Volver a probar').click();assert.equal(await button('Agregar al carrito').isDisabled(),true);
    await button('Elegir Alex Rivera').click();await button('Agregar al carrito').click();await button('Simular empate oficial').click();
    assert.equal(await page.locator('#refund-total').innerText(),'$50.00 MXN');
    if(width===360 && process.env.CHECKOUT_SCREENSHOT){await button('Volver a probar').click();await button('Elegir Alex Rivera').click();await button('Agregar método · +$20').click();await button('KO/TKO').click();await page.screenshot({path:process.env.CHECKOUT_SCREENSHOT,fullPage:true});}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.deepEqual(failures,[]);assert.deepEqual(badRequests,[]);
   }finally{await page.close();}
  });
 }
});

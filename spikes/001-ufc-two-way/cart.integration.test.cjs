const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
require.extensions['.tsx']=(module,path)=>module._compile(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,path);
const storage=new Map();
global.localStorage={getItem:(key)=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:(key)=>storage.delete(key)};
const store=require('../../app/store.tsx').default;
const base={betId:'fight',betName:'A vs B',team:'A fighter',letterTeam:'A',ticketNumbers:1,totalPrice:50};
const extra={...base,method:'KO_TKO',ticketNumbers:1,totalPrice:20};
test('one cart action saves winner and method as separate lines',()=>{
 store.getState().clearCartBets();
 store.getState().updateBetSelection(base,extra);
 assert.deepEqual(store.getState().getBetsFromCart(),[base,extra]);
 assert.deepEqual(store.getState().getTicketInfoByBetId('fight'),{ticketNumbers:1,letterTeam:'A'});
});
test('remove the extra alone, but removing the winner also removes the extra',()=>{
 store.getState().updateBetSelection(base,extra);
 store.getState().removeBetById('fight','method');
 assert.deepEqual(store.getState().getBetsFromCart(),[base]);
 store.getState().updateBetSelection(base,extra);
 store.getState().removeBetById('fight');
 assert.deepEqual(store.getState().getBetsFromCart(),[]);
});
test('changing the winner drops the previous method ticket',()=>{
 store.getState().updateBetSelection(base,extra);
 const replacement={...base,letterTeam:'B',team:'B fighter'};
 store.getState().updateBetSelection(replacement);
 assert.deepEqual(store.getState().getBetsFromCart(),[replacement]);
});

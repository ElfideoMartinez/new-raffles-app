// Browser-safe, deterministic bet payload used by the admin card picker.
export function validateSelection(card,selection){
  const matchup=card.matchups.find(m=>m.id===selection.id);
  if(!matchup)throw new Error('Unknown matchup');
  if(!selection.approved)throw new Error('Explicit approval required');
  const price=Number(selection.price),pool=Number(selection.pool);
  if(!Number.isFinite(price)||price<=0)throw new Error('Invalid ticket price');
  if(!Number.isFinite(pool)||pool<0)throw new Error('Invalid initial pool');
  if(!matchup.a||!matchup.b||!matchup.date||!matchup.image)throw new Error('Matchup missing required data or image');
  if(Date.parse(matchup.date)<=Date.now())throw new Error('Bout date has passed');
  return {matchup,price,pool};
}
export function betPayload(card,selection){
  const {matchup,price,pool}=validateSelection(card,selection);
  return {title:`${matchup.a} vs. ${matchup.b}`,description:`${card.event} · ${matchup.a} vs. ${matchup.b}`,image:matchup.image,date:matchup.date,pricePerTicket:price,teams:{a:matchup.a,b:matchup.b},totalBets:0,initialPool:pool,sourceKey:matchup.id};
}

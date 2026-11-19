/** Settlement can arrive independently of the manual close flag. */
export function isBetClosed(bet: { isFinished?: boolean; settled?: boolean; result?: string }): boolean {
  return bet.isFinished === true || bet.settled === true || Boolean(bet.result);
}
// A missing result is unknown, never an inferred loss.
export function boutResults(competition) {
  const competitors = competition.competitors;
  const status = competition.status?.type;
  const statusText = [status?.name, status?.description, status?.detail, status?.shortDetail]
    .filter((value) => typeof value === "string").join(" ").replace(/[_-]/g, " ");
  if (status?.completed !== true || status.state !== "post" ||
      /\b(cancelled|canceled|postponed|suspended)\b/i.test(statusText)) {
    return competitors.map(() => null);
  }
  const evidence = [statusText, competition.details?.type?.text,
    competition.details?.type?.abbreviation, ...competitors.map((competitor) => competitor.result)]
    .filter((value) => typeof value === "string").join(" ").replace(/[_-]/g, " ");
  const draw = /\b(draw|d)\b/i.test(evidence);
  const noContest = /\b(no contest|nc)\b/i.test(evidence);
  if (draw || noContest) {
    return competitors.map(() => draw && noContest ? null : draw ? "D" : "NC");
  }
  const explicitResults = competitors.map((competitor) => {
    const value = typeof competitor.result === "string" ? competitor.result.trim().toUpperCase() : "";
    if (["W", "WIN"].includes(value)) return "W";
    if (["L", "LOSS"].includes(value)) return "L";
    return null;
  });
  if (explicitResults.some(Boolean)) {
    const explicitWinLoss = competitors.length === 2 &&
      explicitResults.every(Boolean) &&
      explicitResults.filter((result) => result === "W").length === 1 &&
      explicitResults.filter((result) => result === "L").length === 1;
    const consistentWithWinnerFlags = explicitWinLoss && competitors.every((competitor, index) =>
      competitor.winner === undefined || competitor.winner === (explicitResults[index] === "W")
    );
    return consistentWithWinnerFlags ? explicitResults : competitors.map(() => null);
  }
  if (competitors.length !== 2 ||
      competitors.filter((competitor) => competitor.winner === true).length !== 1 ||
      competitors.filter((competitor) => competitor.winner === false).length !== 1) {
    return competitors.map(() => null);
  }
  return competitors.map((competitor) => competitor.winner === true ? "W" : "L");
}

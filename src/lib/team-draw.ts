export type Player = { name: string; present: boolean; monthly?: boolean };

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export function initialDrawOrder(players: Player[]): string[] {
  const present = players.filter((p) => p.present);
  return [
    ...shuffle(present.filter((p) => p.monthly)),
    ...shuffle(present.filter((p) => !p.monthly)),
  ].map((p) => p.name);
}

// Monthly players alternate between A and B up to maxMonthly each; then C, D... are filled one at a time.
export function initialTeams(players: Player[], perTeam: number, maxMonthly = 4): string[][] {
  const present = players.filter((p) => p.present);
  const n = present.length;
  if (!n) return [];
  const k = Math.ceil(n / perTeam);
  const cap = Array.from({ length: k }, (_, i) => (i < k - 1 ? perTeam : n - perTeam * (k - 1)));
  const teams: string[][] = Array.from({ length: k }, () => []);
  const monthly = shuffle(present.filter((p) => p.monthly)).map((p) => p.name);
  const rest = shuffle(present.filter((p) => !p.monthly)).map((p) => p.name);
  const limit = (i: number) => Math.min(maxMonthly, cap[i]!);
  let placed = true;
  while (monthly.length && placed) {
    placed = false;
    for (const i of [0, 1]) {
      if (i < k && monthly.length && teams[i]!.length < limit(i)) { teams[i]!.push(monthly.shift()!); placed = true; }
    }
  }
  for (let i = 2; i < k && monthly.length; i++) {
    while (monthly.length && teams[i]!.length < limit(i)) teams[i]!.push(monthly.shift()!);
  }
  const pool = [...monthly, ...rest];
  teams.forEach((t, i) => { while (t.length < cap[i]! && pool.length) t.push(pool.shift()!); });
  return teams;
}

// Late arrivals keep the normal queue placement, irrespective of membership.
export function lateTeamIndex(teams: string[][], perTeam: number): number {
  const next = teams[2];
  if (next && next.length < perTeam) return 2;
  return teams.findIndex((t) => t.length < perTeam);
}
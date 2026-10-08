import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Racha de Terça — Sorteio de Times" },
      { name: "description", content: "Sorteie os times do futebol de terça, com goleiros fixos e troca de jogadores." },
      { property: "og:title", content: "Racha de Terça — Sorteio de Times" },
      { property: "og:description", content: "Sorteie os times do futebol de terça." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Player = { name: string; present: boolean };
type State = {
  players: Player[];
  keepers: string[];
  perTeam: number;
  teams: string[][]; // [0] e [1] em campo, resto na fila
  labels: string[];
  log: string[];
  fk?: (string | null)[];
  kq?: string[];
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const KEY = "racha-terca-v1";
const initial: State = { players: [], keepers: [], perTeam: 6, teams: [], labels: [], log: [] };

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = b[i] as T; b[i] = b[j] as T; b[j] = t;
  }
  return b;
}

function Index() {
  const [s, setS] = useState<State>(initial);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [keeper, setKeeper] = useState("");
  const [late, setLate] = useState("");


  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) setS({ ...initial, ...JSON.parse(raw) });
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(s));
  }, [s, loaded]);

  const present = s.players.filter((p) => p.present).map((p) => p.name);

  const addPlayer = () => {
    const names = name.split(/[\n,]/).map((n) => n.trim()).filter(Boolean)
      .filter((n) => !s.players.some((p) => p.name === n));
    if (names.length) setS({ ...s, players: [...s.players, ...names.map((n) => ({ name: n, present: true }))] });
    setName("");
  };

  const removePlayer = (i: number) => {
    const pname = s.players[i]?.name;
    if (!pname) return;
    const teams = s.teams.map((t) => [...t]);
    const labels = [...s.labels];
    let fk = s.fk ? [...s.fk] : undefined;
    let kq = s.kq ? [...s.kq] : undefined;
    const log: string[] = [`${pname} se machucou e saiu.`];

    if (s.teams.length) {
      // goleiro fixo em campo?
      const fkIdx = fk ? fk.findIndex((k) => k === pname) : -1;
      if (fkIdx >= 0 && fk) {
        const nextK = kq && kq.length ? kq.shift()! : null;
        if (nextK) log.push(`Goleiro ${pname} sai, entra ${nextK}.`);
        else log.push(`Goleiro ${pname} sai — o gol fica com voluntário.`);
        fk[fkIdx] = nextK;
      }
      // jogador na linha?
      const tIdx = teams.findIndex((t) => t.includes(pname));
      const team = teams[tIdx];
      if (tIdx >= 0 && team) {
        teams[tIdx] = team.filter((p) => p !== pname);
        if (tIdx <= 1) {
          // substituto sorteado do próximo time da fila
          const donor = teams[2];
          if (donor) {
            const pick = shuffle(donor)[0];
            if (pick) {
              teams[2] = donor.filter((p) => p !== pick);
              teams[tIdx] = [...teams[tIdx], pick];
              log.push(`Sorteado do time ${labels[2]} para o Time ${labels[tIdx]}: ${pick}.`);
              if (teams[2]?.length === 0) { teams.splice(2, 1); labels.splice(2, 1); }
            }
          } else {
            log.push(`Sem time de fora — Time ${labels[tIdx]} fica com ${teams[tIdx]?.length ?? 0}.`);
          }
        }
      }
    }

    setS({
      ...s,
      players: s.players.filter((_, j) => j !== i),
      keepers: s.keepers.filter((k) => k !== pname),
      ...(kq !== undefined ? { kq: kq.filter((k) => k !== pname) } : {}),
      ...(fk !== undefined ? { fk } : {}),
      teams, labels,
      log: [...log.reverse(), ...s.log].slice(0, 20),
    });
  };

  const draw = () => {
    const sh = shuffle(present);
    const teams: string[][] = [];
    for (let i = 0; i < sh.length; i += s.perTeam) teams.push(sh.slice(i, i + s.perTeam));
    setS({ ...s, teams, labels: teams.map((_, i) => LETTERS[i] ?? String(i + 1)), log: ["Times sorteados!"], fk: [s.keepers[0] ?? null, s.keepers[1] ?? null], kq: s.keepers.slice(2) });
  };

  const lose = (idx: 0 | 1) => {
    const teams = s.teams.map((t) => [...t]);
    const labels = [...s.labels];
    const loser = teams[idx] ?? [];
    const loserLabel = labels[idx] ?? "";
    const winner = teams[1 - idx] ?? [];
    const winnerLabel = labels[1 - idx] ?? "";
    const queue = teams.slice(2);
    const qLabels = labels.slice(2);
    const log: string[] = [`Time ${loserLabel} perdeu.`];

    if (queue.length === 0) {
      setS({ ...s, log: [...log, "Não há time de fora — mesma partida segue.", ...s.log].slice(0, 20) });
      return;
    }
    let next = queue.shift()!;
    let nextLabel = qLabels.shift()!;
    // sorteia primeiro dos times que estão de fora (fila), depois do time que perdeu
    const donors: { team: string[]; label: string }[] = [
      ...queue.map((t, k) => ({ team: shuffle(t), label: qLabels[k] ?? "" })),
      { team: shuffle(loser), label: loserLabel },
    ];
    const moved: string[] = [];
    const fromLabels: string[] = [];
    for (const d of donors) {
      let took = false;
      while (next.length + moved.length < s.perTeam && d.team.length) { moved.push(d.team.shift()!); took = true; }
      if (took) fromLabels.push(d.label);
    }
    next = [...next, ...moved];
    if (moved.length) {
      log.push(`Time ${nextLabel} tinha ${next.length - moved.length}. Sorteados do time ${fromLabels.join(" e ")}: ${moved.join(", ")}.`);
    }
    const newTeams = [winner, next];
    const newLabels = [winnerLabel, nextLabel];
    for (const d of donors) if (d.team.length) { newTeams.push(d.team); newLabels.push(d.label); }
    log.push(`Entra o time ${nextLabel}.`);
    const fk = s.fk ?? [null, null];
    const kq = [...(s.kq ?? [])];
    const loserK = fk[idx] ?? null;
    let inK = loserK;
    if (loserK && kq.length) { inK = kq.shift()!; kq.push(loserK); log.push(`Goleiro ${loserK} sai, entra ${inK}.`); }
    setS({ ...s, fk: [fk[1 - idx] ?? null, inK], kq, teams: newTeams, labels: newLabels, log: [...log.reverse(), ...s.log].slice(0, 20) });
  };

  const keeperFor = (i: number) =>
    s.fk?.[i] ?? "Voluntário";

  const addLate = () => {
    const names = late.split(/[\n,]/).map((n) => n.trim()).filter(Boolean)
      .filter((n) => !s.teams.flat().includes(n));
    if (!names.length || !s.teams.length) return;
    const teams = s.teams.map((t) => [...t]);
    const labels = [...s.labels];
    const log: string[] = [];
    for (const n of names) {
      // o time da vez (primeiro da fila) tem prioridade; senão, o primeiro time que não estiver completo
      const vezIncompleto = teams.length > 2 && teams[2]!.length < s.perTeam;
      const openIdx = vezIncompleto
        ? 2
        : teams.findIndex((t) => t.length < s.perTeam);
      if (openIdx >= 0) {
        teams[openIdx] = [...teams[openIdx]!, n];
        log.push(`${n} chegou atrasado e entrou no time ${labels[openIdx]}.`);
      } else {
        teams.push([n]);
        labels.push(LETTERS[teams.length - 1] ?? String(teams.length));
        log.push(`${n} chegou atrasado e abriu o time ${labels[teams.length - 1]}.`);
      }
    }
    setS({ ...s, teams, labels, log: [...log.reverse(), ...s.log].slice(0, 20) });
    setLate("");
  };


  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="font-display text-6xl tracking-wide text-primary md:text-7xl">Racha de Terça</h1>
        <p className="text-muted-foreground">Sorteio dos times · {s.perTeam} na linha + 1 no gol</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <section className="space-y-6">
          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-display text-2xl tracking-wide">Jogadores na linha</h2>
            <p className="mb-3 text-sm text-muted-foreground">{present.length} presentes de {s.players.length}</p>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                placeholder="Nome (ou vários separados por vírgula)"
                className="flex-1 rounded-md border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button onClick={addPlayer} className="rounded-md bg-primary px-4 font-semibold text-primary-foreground">+</button>
            </div>
            <ul className="mt-3 max-h-72 space-y-1 overflow-auto">
              {s.players.map((p, i) => (
                <li key={p.name} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={p.present}
                    className="accent-primary"
                    onChange={() => setS({ ...s, players: s.players.map((q, j) => (j === i ? { ...q, present: !q.present } : q)) })}
                  />
                  <span className={p.present ? "" : "text-muted-foreground line-through"}>{p.name}</span>
                  <button
                    onClick={() => removePlayer(i)}
                    title="Excluir jogador"
                    className="ml-auto text-sm text-muted-foreground hover:text-destructive"
                  >✕</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-display text-2xl tracking-wide">Goleiros fixos</h2>
            <p className="mb-3 text-sm text-muted-foreground">Sem goleiro fixo, o gol fica com voluntário.</p>
            <div className="flex gap-2">
              <input
                value={keeper}
                onChange={(e) => setKeeper(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && keeper.trim()) { setS({ ...s, keepers: [...s.keepers, keeper.trim()] }); setKeeper(""); }
                }}
                placeholder="Nome do goleiro"
                className="flex-1 rounded-md border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => { if (keeper.trim()) { setS({ ...s, keepers: [...s.keepers, keeper.trim()] }); setKeeper(""); } }}
                className="rounded-md bg-accent px-4 font-semibold text-accent-foreground"
              >+</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.keepers.map((k, i) => (
                <span key={i} className="flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                  🧤 {k}
                  <button onClick={() => {
                    const removed = s.keepers[i];
                    setS({
                      ...s,
                      keepers: s.keepers.filter((_, j) => j !== i),
                      ...(s.fk ? { fk: s.fk.map((k) => (k === removed ? null : k)) } : {}),
                      ...(s.kq ? { kq: s.kq.filter((k) => k !== removed) } : {}),
                    });
                  }}>✕</button>
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 font-display text-2xl tracking-wide">Jogadores na linha por time</h2>
            <div className="flex gap-2">
              {[4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => setS({ ...s, perTeam: n })}
                  className={`flex-1 rounded-md py-2 font-display text-2xl ${s.perTeam === n ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >{n}</button>
              ))}
            </div>
            <button
              onClick={draw}
              disabled={present.length < 2}
              className="mt-4 w-full rounded-md bg-primary py-3 font-display text-3xl tracking-wide text-primary-foreground disabled:opacity-40"
            >⚽ Sortear times</button>
          </div>
        </section>

        <section className="space-y-6">
          {s.teams.length === 0 ? (
            <div className="flex h-full min-h-60 items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Adicione os jogadores e clique em “Sortear times”.
            </div>
          ) : (
            <>
              <div>
                <h2 className="mb-3 font-display text-3xl tracking-wide">Em campo</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1].map((i) =>
                    s.teams[i] ? (
                      <div key={i} className="rounded-lg border-2 border-primary bg-card p-4">
                        <div className="flex items-baseline justify-between">
                          <h3 className="font-display text-4xl text-primary">Time {s.labels[i]}</h3>
                          <span className="text-sm text-muted-foreground">{s.teams[i].length}/{s.perTeam}</span>
                        </div>
                        <p className="mb-2 text-sm text-accent">🧤 {keeperFor(i)}</p>
                        <ol className="mb-4 list-inside list-decimal space-y-0.5">
                          {s.teams[i].map((p) => <li key={p}>{p}</li>)}
                        </ol>
                        {s.teams[1] && (
                          <button onClick={() => lose(i as 0 | 1)} className="w-full rounded-md bg-destructive py-2 font-semibold">
                            Time {s.labels[i]} perdeu
                          </button>
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>

              {s.teams.length > 2 && (
                <div>
                  <h2 className="mb-3 font-display text-3xl tracking-wide">Próximos</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.teams.slice(2).map((t, k) => (
                      <div key={k} className="rounded-lg border bg-card p-4">
                        <div className="flex items-baseline justify-between">
                          <h3 className="font-display text-2xl">{k + 1}º · Time {s.labels[k + 2]}</h3>
                          <span className={`text-sm ${t.length < s.perTeam ? "text-accent" : "text-muted-foreground"}`}>
                            {t.length}/{s.perTeam}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{t.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-card p-4">
                <h2 className="mb-2 font-display text-2xl tracking-wide">Chegou atrasado?</h2>
                <p className="mb-3 text-sm text-muted-foreground">Entra primeiro no time da vez até ele ficar completo; se já estiver completo, entra no primeiro time que não estiver completo. Se todos estiverem completos, abre um time novo.</p>
                <div className="flex gap-2">
                  <input
                    value={late}
                    onChange={(e) => setLate(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLate()}
                    placeholder="Nome (ou vários separados por vírgula)"
                    className="flex-1 rounded-md border bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={addLate}
                    disabled={!s.teams.length}
                    className="rounded-md bg-accent px-4 font-semibold text-accent-foreground disabled:opacity-40"
                  >+</button>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <h2 className="mb-2 font-display text-2xl tracking-wide">Histórico</h2>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {s.log.map((l, i) => <li key={i}>• {l}</li>)}
                </ul>
              </div>

            </>
          )}
        </section>
      </div>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
// import logo from "@/assets/canela-de-vidro-logo.png.asset.json";
import logo from "../assets/canela-de-vidro-logo.png";
import { Star } from "lucide-react";
import { Button } from "../components/button";
import { initialTeams, lateTeamIndex, shuffle, type Player } from "@/lib/team-draw";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Canela de Vidro FC — Sorteio de Times" },
      { name: "description", content: "Sorteie os times do Canela de Vidro FC, com goleiros fixos e troca de jogadores." },
      { property: "og:title", content: "Canela de Vidro FC — Sorteio de Times" },
      { property: "og:description", content: "Sorteio dos times do Canela de Vidro FC, com goleiros fixos e fila de partidas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type State = {
  players: Player[];
  keepers: string[];
  perTeam: number;
  maxMonthly?: number;
  teams: string[][]; // [0] e [1] em campo, resto na fila
  labels: string[];
  log: string[];
  fk?: (string | null)[];
  kq?: string[];
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const KEY = "racha-terca-v1";
const initial: State = { players: [], keepers: [], perTeam: 6, teams: [], labels: [], log: [] };

// Completa automaticamente os times da fila: um time incompleto recebe
// jogadores sorteados dos times que estão atrás dele na fila.
function autofill(teams: string[][], labels: string[], perTeam: number, log: string[]) {
  for (let i = 2; i < teams.length; i++) {
    const t = teams[i];
    if (!t || t.length >= perTeam) continue;
    for (let j = teams.length - 1; j > i && t.length < perTeam; j--) {
      const donor = shuffle(teams[j] ?? []);
      while (t.length < perTeam && donor.length) t.push(donor.shift()!);
      teams[j] = donor;
      if (donor.length === 0) { teams.splice(j, 1); labels.splice(j, 1); }
    }
    if (t.length >= perTeam) log.push(`Time ${labels[i]} completado: entra com ${t.join(", ")}.`);
  }
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

    autofill(teams, labels, s.perTeam, log);
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
    const teams = initialTeams(s.players, s.perTeam, s.maxMonthly ?? 4);
    const labels = teams.map((_, i) => LETTERS[i] ?? String(i + 1));
    const log = ["Times sorteados!"];
    autofill(teams, labels, s.perTeam, log);
    setS({ ...s, teams, labels, log, fk: [s.keepers[0] ?? null, s.keepers[1] ?? null], kq: s.keepers.slice(2) });
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
    autofill(newTeams, newLabels, s.perTeam, log);
    setS({ ...s, fk: [fk[1 - idx] ?? null, inK], kq, teams: newTeams, labels: newLabels, log: [...log.reverse(), ...s.log].slice(0, 20) });
  };

  const keeperFor = (i: number) =>
    s.fk?.[i] ?? "Voluntário";

  const addLate = () => {
    const names = [...new Set(late.split(/[\n,]/).map((n) => n.trim()).filter(Boolean))]
      .filter((n) => !s.teams.flat().includes(n));
    if (!names.length || !s.teams.length) return;
    const teams = s.teams.map((t) => [...t]);
    const labels = [...s.labels];
    const log: string[] = [];
    for (const n of names) {
      // o time da vez (primeiro da fila) tem prioridade; senão, o primeiro time que não estiver completo
      const openIdx = lateTeamIndex(teams, s.perTeam);
      if (openIdx >= 0) {
        teams[openIdx] = [...(teams[openIdx] ?? []), n];
        log.push(`${n} chegou atrasado e entrou no time ${labels[openIdx]}.`);
      } else {
        teams.push([n]);
        labels.push(LETTERS[teams.length - 1] ?? String(teams.length));
        log.push(`${n} chegou atrasado e abriu o time ${labels[teams.length - 1]}.`);
      }
    }
    autofill(teams, labels, s.perTeam, log);
    const players = s.players.map((p) => names.includes(p.name) ? { ...p, present: true } : p);
    for (const n of names) {
      if (!players.some((p) => p.name === n)) players.push({ name: n, present: true });
    }
    setS({ ...s, players, teams, labels, log: [...log.reverse(), ...s.log].slice(0, 20) });
    setLate("");
  };


  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1>
          <img src={logo} alt="Canela de Vidro FC" width={640} height={640} className="mx-auto mb-3 h-40 w-40 object-contain md:h-48 md:w-48" />
        </h1>
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
                    aria-label={`Presença de ${p.name}`}
                    checked={p.present}
                    className="accent-primary"
                    onChange={() => setS({ ...s, players: s.players.map((q, j) => (j === i ? { ...q, present: !q.present } : q)) })}
                  />
                  <span className={`min-w-0 flex-1 break-words ${p.present ? "" : "text-muted-foreground line-through"}`}>{p.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Mensalista: ${p.name}`}
                    aria-pressed={Boolean(p.monthly)}
                    title={p.monthly ? "Retirar mensalista" : "Marcar mensalista"}
                    className={`shrink-0 ${p.monthly ? "text-accent" : "text-muted-foreground"}`}
                    onClick={() => setS({ ...s, players: s.players.map((q, j) => j === i ? { ...q, monthly: !q.monthly } : q) })}
                  ><Star className={p.monthly ? "fill-current" : ""} /></Button>
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
                  onClick={() => {
                    if (n === s.perTeam) return;
                    if (s.teams.length && !confirm("Mudar o número de jogadores apaga os times atuais. Sortear de novo depois?")) return;
                    setS({ ...s, perTeam: n, teams: [], labels: [], log: [] });
                  }}
                  className={`flex-1 rounded-md py-2 font-display text-2xl ${s.perTeam === n ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >{n}</button>
              ))}
            </div>
            <h2 className="mb-3 mt-5 font-display text-2xl tracking-wide">Máx. mensalistas por time</h2>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setS({ ...s, maxMonthly: n })}
                  className={`flex-1 rounded-md py-2 font-display text-2xl ${(s.maxMonthly ?? 4) === n ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
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
                          <span className="text-sm text-muted-foreground">Linha: {s.teams[i].length}/{s.perTeam}</span>
                        </div>
                        <p className="mb-2 rounded-md bg-secondary px-2 py-1 text-sm text-accent">🧤 Gol (não conta na linha): {keeperFor(i)}</p>
                        <ol className="mb-4 list-inside list-decimal space-y-0.5">
                          {s.teams[i].map((p) => <li key={p}>{p}{s.players.some((q) => q.name === p && q.monthly) && <Star aria-label="Mensalista" className="ml-1 inline size-3.5 fill-current text-accent" />}</li>)}
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
                        <p className="text-sm text-muted-foreground">{t.map((p, index) => <span key={p}>{index > 0 && ", "}{p}{s.players.some((q) => q.name === p && q.monthly) && <Star aria-label="Mensalista" className="ml-1 inline size-3.5 fill-current text-accent" />}</span>)}</p>
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

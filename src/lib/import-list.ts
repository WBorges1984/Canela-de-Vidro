// Lê a lista colada do WhatsApp: seções "mensalista" marcam estrela, "diarista" não.
export function parsePlayerList(text: string): { name: string; monthly: boolean }[] {
  const out: { name: string; monthly: boolean }[] = [];
  let monthly = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[\u2060\u200B\uFEFF]/g, "").trim();
    if (/mensalista/i.test(line)) { monthly = true; continue; }
    if (/diarista/i.test(line) && !/^\d+\./.test(line)) { monthly = false; continue; }
    const m = line.match(/^\d+[.)-]\s*(.+)$/);
    if (!m?.[1]) continue;
    const name = m[1].replace(/[✅✔☑️]/gu, "").replace(/\s+/g, " ").trim();
    if (name && !out.some((p) => p.name.toLowerCase() === name.toLowerCase())) out.push({ name, monthly });
  }
  return out;
}

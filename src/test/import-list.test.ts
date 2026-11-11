import { describe, it, expect } from "vitest";
import { parsePlayerList } from "@/lib/import-list";
const text = `@all\nObs: diaristas colocar o nome na lista só depois de efetuar o pagamento.\n\nLista de presença (mensalista)10/11\n\n1. Hugo L.\n2. \u2060Brendon \n\nLista de presença \n(Diarista)10/11\n\n1. Paulo Roberto✅\n2. \u2060 Iago ✅`;
describe("parsePlayerList", () => {
  it("marca mensalistas e limpa nomes", () => {
    expect(parsePlayerList(text)).toEqual([
      { name: "Hugo L.", monthly: true }, { name: "Brendon", monthly: true },
      { name: "Paulo Roberto", monthly: false }, { name: "Iago", monthly: false },
    ]);
  });
});

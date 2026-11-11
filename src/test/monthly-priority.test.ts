import { describe, expect, it } from "vitest";
import { initialDrawOrder, initialTeams, lateTeamIndex, type Player } from "@/lib/team-draw";

describe("monthly players", () => {
  it("fills the first two six-player teams with monthly players first", () => {
    const regular: Player[] = Array.from({ length: 10 }, (_, i) => ({ name: `R${i}`, present: true }));
    const monthly: Player[] = Array.from({ length: 8 }, (_, i) => ({ name: `M${i}`, present: true, monthly: true }));
    const result = initialDrawOrder([...regular, ...monthly]);
    expect(new Set(result.slice(0, 8))).toEqual(new Set(monthly.map((p) => p.name)));
    expect(result.slice(0, 12).filter((name) => name.startsWith("M"))).toHaveLength(8);
    expect(new Set(result).size).toBe(18);
  });

  it("spreads monthly players with at most 4 per team, A/B first then C", () => {
    const regular: Player[] = Array.from({ length: 9 }, (_, i) => ({ name: `R${i}`, present: true }));
    const monthly: Player[] = Array.from({ length: 9 }, (_, i) => ({ name: `M${i}`, present: true, monthly: true }));
    const teams = initialTeams([...regular, ...monthly], 6);
    const count = (t?: string[]) => (t ?? []).filter((n) => n.startsWith("M")).length;
    expect(teams.map((t) => t.length)).toEqual([6, 6, 6]);
    expect([count(teams[0]), count(teams[1]), count(teams[2])]).toEqual([4, 4, 1]);
  });

  it("alternates monthly players between A and B", () => {
    const players: Player[] = [
      ...Array.from({ length: 4 }, (_, i) => ({ name: `M${i}`, present: true, monthly: true })),
      ...Array.from({ length: 8 }, (_, i) => ({ name: `R${i}`, present: true })),
    ];
    const teams = initialTeams(players, 6);
    expect(teams[0]!.filter((n) => n.startsWith("M"))).toHaveLength(2);
    expect(teams[1]!.filter((n) => n.startsWith("M"))).toHaveLength(2);
  });

  it("keeps absent monthly players out of the draw", () => {
    expect(initialDrawOrder([
      { name: "Ausente", present: false, monthly: true },
      { name: "Presente", present: true },
    ])).toEqual(["Presente"]);
  });

  it("places a late monthly player in the incomplete next team, without replacing anyone in the first teams", () => {
    const teams = [Array(6).fill("A"), Array(6).fill("B"), ["C1", "C2", "C3", "C4"]];
    const monthly: Player = { name: "Mensalista atrasado", monthly: true, present: true };
    const index = lateTeamIndex(teams, 6);
    teams[index]?.push(monthly.name);
    expect(index).toBe(2);
    expect(teams[0]).toHaveLength(6);
    expect(teams[1]).toHaveLength(6);
    expect(teams[2]).toEqual(["C1", "C2", "C3", "C4", "Mensalista atrasado"]);
  });
});
describe("monthly cap and sequential fill", () => {
  it("fills C up to the cap before D", () => {
    const players: Player[] = [
      ...Array.from({ length: 14 }, (_, i) => ({ name: `M${i}`, present: true, monthly: true })),
      ...Array.from({ length: 10 }, (_, i) => ({ name: `R${i}`, present: true })),
    ];
    const teams = initialTeams(players, 6, 4);
    const c = teams.map((t) => t.filter((n) => n.startsWith("M")).length);
    expect(teams.map((t) => t.length)).toEqual([6, 6, 6, 6]);
    expect(c).toEqual([4, 4, 4, 2]);
  });
  it("respects a custom cap of 2", () => {
    const players: Player[] = [
      ...Array.from({ length: 6 }, (_, i) => ({ name: `M${i}`, present: true, monthly: true })),
      ...Array.from({ length: 12 }, (_, i) => ({ name: `R${i}`, present: true })),
    ];
    const c = initialTeams(players, 6, 2).map((t) => t.filter((n) => n.startsWith("M")).length);
    expect(c).toEqual([2, 2, 2]);
  });
});

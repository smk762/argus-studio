import { describe, expect, it } from "vitest";
import { BRANCHES, PIPELINE, branchesFrom, stageFor } from "@/lib/pipeline";

describe("branchesFrom", () => {
  it("shows stage branches always and external ones only when configured", () => {
    expect(branchesFrom("/darkroom", {}).map((b) => b.href)).toEqual(["/forge"]);
    const all = branchesFrom("/darkroom", { mask: "https://mask.example/", assay: "https://assay.example/" });
    expect(all.map((b) => b.label)).toEqual(["Train a new LoRA in Forge", "Rig a face in Mask", "Mint a provenance card in Assay"]);
    expect(all[1].external).toEqual({ service: "argus-mask" });
    expect(all[0].external).toBeNull();
  });

  it("treats a blank URL as not deployed", () => {
    expect(branchesFrom("/darkroom", { mask: "  ", assay: "" }).map((b) => b.href)).toEqual(["/forge"]);
  });

  it("takes the destination stage's tone", () => {
    expect(branchesFrom("/darkroom", {})[0].tone).toBe(stageFor("/forge")?.tone);
  });

  it("resolves the source like stageFor (trailing slash, query)", () => {
    expect(branchesFrom("/darkroom/?record=1", {})).toHaveLength(1);
  });

  it("is empty for a stage that doesn't branch", () => {
    expect(branchesFrom("/curate", { mask: "https://mask.example/" })).toEqual([]);
  });

  it("only branches from and to pipeline stages", () => {
    for (const [from, branches] of Object.entries(BRANCHES)) {
      expect(PIPELINE.some((s) => s.href === from)).toBe(true);
      for (const b of branches) if (b.kind === "stage") expect(stageFor(b.href)).toBeDefined();
    }
  });
});

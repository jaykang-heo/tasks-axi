import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { parseBacklog } from "../../src/backends/markdown-grammar.js";
import { FIRSTMATE_V2_FIXTURE, makeBacklog } from "../helpers.js";

const MAP = `# Backlog

## [/] 1. Request root (repo: demo) <!--#req-->
  ## Destination
  The outcome.

- [/] 1. Parent work (kind: ship) <!--#par-->
  parent body
  - [x] 1. Child one (kind: ship) (done 2026-06-20) <!--#c1-->
  - [ ] 2. Child two (kind: ship) blocked-by: c1 <!--#c2-->
- [ ] 2. Held call (kind: captain) (hold: pick A or B) (hold-kind: captain) <!--#call-->

## [/] 2. Unfiled <!--#unfiled-->
- [/] 1. Loose work (kind: ship) (since 2026-06-01) <!--#loose-->
- [x] 2. Old done (kind: ship) (done 2026-06-02) <!--#old-->
`;

describe("MarkdownStore on the hierarchical (v2) map", () => {
  it("reads every task with state, hold and dependency edges", async () => {
    const b = makeBacklog(MAP);
    try {
      const { items } = await b.store.list({});
      const by = Object.fromEntries(items.map((t) => [t.id, t]));
      expect(Object.keys(by).sort()).toEqual(["c1", "c2", "call", "loose", "old", "par"]);
      expect(by.par?.state).toBe("in_flight");
      expect(by.c1?.state).toBe("done");
      expect(by.c2?.state).toBe("queued");
      expect(by.c2?.deps).toEqual([{ type: "blocked-by", id: "c1" }]);
      expect(by.call?.hold?.kind).toBe("captain");
    } finally {
      b.cleanup();
    }
  });

  it("rewrites only the edited record and keeps every other line byte-identical", async () => {
    const b = makeBacklog(MAP);
    try {
      await b.store.update("loose", { priority: 1 });
      const before = MAP.split("\n");
      const after = b.read().split("\n");
      expect(after.length).toBe(before.length);
      const changed = after.filter((line, i) => line !== before[i]);
      expect(changed).toEqual(["- [/] 1. Loose work (kind: ship) (priority: 1) (since 2026-06-01) <!--#loose-->"]);
    } finally {
      b.cleanup();
    }
  });

  it("flips a leaf checkbox in place and rolls markers up", async () => {
    const b = makeBacklog(MAP);
    try {
      await b.store.transition("c2", "done");
      await b.store.transition("call", "done");
      const text = b.read();
      expect(text).toContain("  - [x] 2. Child two");
      expect(text).toContain("- [x] 1. Parent work (kind: ship) <!--#par-->");
      expect(text).toContain("## [x] 1. Request root (repo: demo) <!--#req-->");
    } finally {
      b.cleanup();
    }
  });

  it("refuses to set a parent's state directly and leaves the file untouched", async () => {
    const b = makeBacklog(MAP);
    try {
      const before = b.read();
      await expect(b.store.transition("par", "done")).rejects.toThrow(/derived from its children/);
      expect(b.read()).toBe(before);
    } finally {
      b.cleanup();
    }
  });

  it("files new tasks under Unfiled and removes leaves", async () => {
    const b = makeBacklog(MAP);
    try {
      await b.store.create({ id: "fresh", title: "fresh work", kind: "ship" });
      expect(b.read()).toMatch(/- \[ \] 3\. fresh work \(kind: ship\).*<!--#fresh-->/);
      await b.store.remove("fresh");
      expect(b.read()).not.toContain("fresh");
    } finally {
      b.cleanup();
    }
  });

  it("prunes only Unfiled done work, keeping a root's completion evidence", async () => {
    const b = makeBacklog(MAP);
    try {
      const result = await b.store.prune({ state: "done", keep: 0, archive: true });
      expect(result.ids).toEqual(["old"]);
      expect(b.read()).toContain("<!--#c1-->");
      expect(b.archive()).toContain("old");
    } finally {
      b.cleanup();
    }
  });

  it("refuses new tasks that collide with the Unfiled root and leaves the file untouched", async () => {
    const COLLIDING = `# Backlog

## [/] 1. Request root (repo: demo) <!--#req-->
  ## Destination
  The outcome.

- [/] 1. Parent work (kind: ship) <!--#par-->
  parent body
  - [x] 1. Child one (kind: ship) (done 2026-06-20) <!--#c1-->
  - [ ] 2. Child two (kind: ship) blocked-by: c1 <!--#c2-->
- [ ] 2. Held call (kind: captain) (hold: pick A or B) (hold-kind: captain) <!--#call-->
- [ ] 3. Oddly named (kind: ship) <!--#unfiled-->
`;
    const b = makeBacklog(COLLIDING);
    try {
      const before = b.read();
      await expect(b.store.create({ id: "fresh", title: "fresh work", kind: "ship" })).rejects.toThrow(
        /id "unfiled" is already used/,
      );
      expect(b.read()).toBe(before);
      const { items } = await b.store.list({});
      expect(items.map((t) => t.id).sort()).toEqual(["c1", "c2", "call", "par", "unfiled"]);
    } finally {
      b.cleanup();
    }
  });

  it("reserves the unfiled id for new tasks and leaves the file untouched", async () => {
    const b = makeBacklog(MAP);
    try {
      const before = b.read();
      await expect(b.store.create({ id: "unfiled", title: "sneaky", kind: "ship" })).rejects.toThrow(/reserved/);
      expect(b.read()).toBe(before);
    } finally {
      b.cleanup();
    }
  });

  it("preserves a CRLF file's newline style on write", async () => {
    const b = makeBacklog(MAP.replace(/\n/g, "\r\n"));
    try {
      await b.store.update("loose", { priority: 1 });
      const text = b.read();
      expect(text).toContain("\r\n");
      expect(text).not.toMatch(/[^\r]\n/);
      expect(text).toContain(
        "- [/] 1. Loose work (kind: ship) (priority: 1) (since 2026-06-01) <!--#loose-->\r",
      );
    } finally {
      b.cleanup();
    }
  });

  it("preserves the parent-body blank separator across mutations", async () => {
    const SPACED = MAP.replace("  parent body\n  - [x] 1. Child one", "  parent body\n\n  - [x] 1. Child one");
    const b = makeBacklog(SPACED);
    try {
      await b.store.update("loose", { priority: 1 });
      const once = b.read();
      expect(once).toContain("  parent body\n\n  - [x] 1. Child one");
      await b.store.update("call", { priority: 1 });
      const before = once.split("\n");
      const after = b.read().split("\n");
      expect(after.filter((line, i) => line !== before[i])).toEqual([
        "- [ ] 2. Held call (kind: captain) (priority: 1) (hold: pick A or B) (hold-kind: captain) <!--#call-->",
      ]);
    } finally {
      b.cleanup();
    }
  });

  it("refuses malformed or mixed files instead of dropping rows", async () => {
    const b = makeBacklog(MAP);
    try {
      writeFileSync(b.path, MAP + "- stray bullet\n");
      await expect(b.store.list({})).rejects.toThrow(/not a task record/);
      writeFileSync(b.path, MAP + "\n## Queued\n- [ ] q - queued row\n");
      await expect(b.store.list({})).rejects.toThrow(/mixes/);
      writeFileSync(b.path, MAP.replace("## [/] 1. Request", "## [ ] 1. Request"));
      await expect(b.store.list({})).rejects.toThrow(/stale marker/);
    } finally {
      b.cleanup();
    }
  });
});

describe("MarkdownStore on a canonical-shaped v2 backlog", () => {
  it("reads every task with state, captain holds, dependency edges, and prose links", async () => {
    const b = makeBacklog(FIRSTMATE_V2_FIXTURE);
    try {
      const { items } = await b.store.list({});
      const by = Object.fromEntries(items.map((t) => [t.id, t]));
      expect(Object.keys(by).sort()).toEqual([
        "firstmate-delivery-enforcement",
        "old-loose-end",
        "request-delivery-integrated-verification",
        "request-delivery-reliability",
        "reward-processor-production-rollout",
        "unattended-pr-cleanup",
        "wallet-currency-overpayment-decisions",
        "wallet-currency-overpayment-followup",
      ]);
      expect(by["request-delivery-reliability"]?.state).toBe("in_flight");
      expect(by["request-delivery-integrated-verification"]?.state).toBe("queued");
      expect(by["wallet-currency-overpayment-followup"]?.state).toBe("done");
      expect(by["firstmate-delivery-enforcement"]?.hold).toEqual({
        reason: "Captain decision pending on the lease wording",
        kind: "captain",
      });
      expect(by["wallet-currency-overpayment-decisions"]?.hold?.kind).toBe("captain");
      expect(by["request-delivery-integrated-verification"]?.deps).toEqual([
        { type: "blocked-by", id: "request-delivery-reliability" },
        { type: "blocked-by", id: "firstmate-delivery-enforcement" },
      ]);
      expect(by["unattended-pr-cleanup"]?.deps).toEqual([
        { type: "discovered-from", id: "request-delivery-reliability" },
      ]);
      expect(by["unattended-pr-cleanup"]?.priority).toBe(0);
      expect(
        by["wallet-currency-overpayment-followup"]?.links.some(
          (l) => l.kind === "report" && l.url === "data/backlog-architecture-reframe/report.md",
        ),
      ).toBe(true);
      expect(
        by["reward-processor-production-rollout"]?.links.some(
          (l) => l.kind === "pr" && l.url === "https://github.com/o/r/pull/12",
        ),
      ).toBe(true);
    } finally {
      b.cleanup();
    }
  });

  it("round-trips the canonical-shaped file byte-exact, and a targeted edit touches one line", async () => {
    const b = makeBacklog(FIRSTMATE_V2_FIXTURE);
    try {
      await expect(b.store.render()).resolves.toBe(8);
      expect(b.read()).toBe(FIRSTMATE_V2_FIXTURE);
      await b.store.update("unattended-pr-cleanup", { priority: 1 });
      const before = FIRSTMATE_V2_FIXTURE.split("\n");
      const after = b.read().split("\n");
      expect(after.filter((line, i) => line !== before[i])).toEqual([
        "- [ ] 1. Inspect unattended PRs discovered-from: request-delivery-reliability (repo: rune) (kind: scout) (priority: 1) <!--#unattended-pr-cleanup-->",
      ]);
    } finally {
      b.cleanup();
    }
  });

  it("leaves no task visible to the flat grammar, so a pre-v2 reader goes blind instead of half-reading", () => {
    let tasks = 0;
    for (const section of parseBacklog(FIRSTMATE_V2_FIXTURE).sections) {
      for (const entry of section.entries) {
        if (entry.kind === "task") tasks++;
      }
    }
    expect(tasks).toBe(0);
  });
});

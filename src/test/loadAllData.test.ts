// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  failing: new Set<string>(),
  rows: {} as Record<string, unknown[]>,
  orders: [] as [string, string][],
}));

// Builder minimo do supabase-js: from(t).select(c).order(col).range(a, b)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: (col: string) => {
          state.orders.push([table, col]);
          return {
            range: async (from: number, to: number) => state.failing.has(table)
              ? { data: null, error: { message: "upstream connect timeout" } }
              : { data: (state.rows[table] || []).slice(from, to + 1), error: null },
          };
        },
      }),
    }),
  },
}));

import { loadAllData, selectAll } from "@/lib/supabaseData";

beforeEach(() => {
  state.failing.clear();
  state.rows = {};
  state.orders = [];
});

describe("loadAllData", () => {
  it("reports which slices failed instead of passing them off as empty", async () => {
    state.rows.tasks = [{ id: "t1", title: "x", assignee: "Flávio" }];
    state.failing.add("tasks");
    const data = await loadAllData();
    expect(data._failed).toEqual(["tasks"]);
    expect(data.tasks).toEqual([]);
  });

  it("marks clients as failed when one of its joined tables fails", async () => {
    state.failing.add("client_team_assignments");
    const data = await loadAllData();
    expect(data._failed).toEqual(["clients"]);
  });

  it("reports nothing when every query succeeds", async () => {
    const data = await loadAllData();
    expect(data._failed).toEqual([]);
  });
});

describe("selectAll", () => {
  it("orders every page by the primary key so pages never skip rows", async () => {
    state.rows.tasks = Array.from({ length: 2500 }, (_, i) => ({ id: `t${i}` }));
    const rows = await selectAll("tasks");
    expect(rows).toHaveLength(2500);
    expect(state.orders).toEqual([["tasks", "id"], ["tasks", "id"], ["tasks", "id"]]);
  });

  it("uses the real key for tables keyed by client or user", async () => {
    await selectAll("client_dna");
    await selectAll("productivity");
    expect(state.orders).toEqual([["client_dna", "client_id"], ["productivity", "user_id"]]);
  });
});

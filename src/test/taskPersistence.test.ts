// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createTaskSaver, isTransient } from "@/lib/taskPersistence";
import type { Task } from "@/data/mockData";

const task = (id: string, title = id): Task => ({
  id, title, client: "", clientId: "", module: "Tráfego", sector: "Tráfego", type: "Tarefa",
  assignee: "Flávio", deadline: "2026-10-29", urgency: "normal", status: "backlog",
  weight: 1, estimatedHours: 1, hasRework: false, createdAt: "2026-10-29",
} as Task);

const ok = { error: null, status: 201 };
const gatewayTimeout = { error: { message: "522" }, status: 522 };
const noResponse = { error: { message: "Failed to fetch" }, status: 0 };
const badRequest = { error: { message: "invalid input" }, status: 400 };
const noSleep = () => Promise.resolve();

describe("task saver", () => {
  it("retries transient failures until the write lands", async () => {
    const write = vi.fn().mockResolvedValueOnce(gatewayTimeout).mockResolvedValueOnce(noResponse).mockResolvedValueOnce(ok);
    const saver = createTaskSaver(write, noSleep);
    await expect(saver.save(task("t1"))).resolves.toBe("saved");
    expect(write).toHaveBeenCalledTimes(3);
    expect(saver.pendingCount()).toBe(0);
  });

  it("keeps an unsaved task visible across reloads while the database is down", async () => {
    const saver = createTaskSaver(vi.fn().mockResolvedValue(gatewayTimeout), noSleep);
    const local = task("t-new", "criada durante a queda");
    await expect(saver.save(local)).resolves.toBe("pending");
    const fromDb = [task("t-old")];
    expect(saver.merge(fromDb).map((t) => t.id)).toEqual(["t-old", "t-new"]);
  });

  it("prefers the local unsaved version over the stale row from the database", async () => {
    const saver = createTaskSaver(vi.fn().mockResolvedValue(gatewayTimeout), noSleep);
    await saver.save({ ...task("t1"), status: "done" });
    expect(saver.merge([{ ...task("t1"), status: "backlog" }])[0].status).toBe("done");
  });

  it("does not retry or keep a task the database rejected", async () => {
    const write = vi.fn().mockResolvedValue(badRequest);
    const saver = createTaskSaver(write, noSleep);
    await expect(saver.save(task("t1"))).resolves.toBe("rejected");
    expect(write).toHaveBeenCalledTimes(1);
    expect(saver.merge([])).toEqual([]);
  });

  it("never lets an older retry overwrite a newer edit of the same task", async () => {
    let wake!: () => void;
    const sleep = () => new Promise<void>((r) => { wake = r; });
    const written: string[] = [];
    const write = vi.fn(async (t: Task) => {
      written.push(t.title);
      return written.length === 1 ? gatewayTimeout : ok;
    });
    const saver = createTaskSaver(write, sleep);
    const first = saver.save(task("t1", "v1"));
    await vi.waitFor(() => expect(written).toEqual(["v1"]));
    const second = saver.save(task("t1", "v2"));
    wake();
    await expect(first).resolves.toBe("superseded");
    await expect(second).resolves.toBe("saved");
    expect(written).toEqual(["v1", "v2"]);
  });

  it("resends pending tasks when asked and stops tracking deleted ones", async () => {
    const write = vi.fn().mockResolvedValue(gatewayTimeout);
    const saver = createTaskSaver(write, noSleep);
    await saver.save(task("keep"));
    await saver.save(task("gone"));
    saver.forget("gone");
    write.mockResolvedValue(ok);
    const results: string[] = [];
    saver.retryPending((t, r) => results.push(`${t.id}:${r}`));
    await vi.waitFor(() => expect(results).toEqual(["keep:saved"]));
    expect(saver.pendingCount()).toBe(0);
  });

  it("classifies statuses", () => {
    expect([0, undefined, 408, 429, 500, 503, 522].every(isTransient)).toBe(true);
    expect([400, 401, 403, 404, 409].some(isTransient)).toBe(false);
  });
});

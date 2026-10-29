// Gravacao de tarefas que nao some quando o banco engasga.
//
// Antes, cada tela fazia `db('tasks').upsert(...)` e seguia em frente. Se o
// Supabase devolvesse 522/504 (instancia sobrecarregada, out/2026), a tarefa
// ficava so na memoria e o proximo reload -- realtime, o intervalo de 5 min ou
// um F5 -- trocava a lista pelo que estava no banco: a tarefa sumia.
//
// Aqui a escrita e retentada em falhas transitorias e, enquanto nao confirma,
// a tarefa fica numa lista de pendentes que os reloads mesclam por cima do banco.
// As escritas de uma mesma tarefa saem em fila, para uma retentativa antiga
// nunca sobrescrever uma edicao mais nova.

import type { Task } from "@/data/mockData";

// pending: banco fora apos as retentativas; a tarefa segue na tela e sera reenviada.
// rejected: o banco recusou o dado (4xx); reenviar nao adianta.
export type SaveResult = "saved" | "pending" | "rejected" | "superseded";

type WriteFn = (task: Task) => Promise<{ error: { message?: string } | null; status?: number }>;

const RETRY_DELAYS_MS = [2000, 5000, 15000];

// Sem resposta (status 0/undefined: rede caiu, timeout) ou erro do lado do
// servidor/gateway vale tentar de novo. 4xx e dado invalido: repetir nao adianta.
export function isTransient(status: number | undefined): boolean {
  return !status || status === 408 || status === 429 || status >= 500;
}

export function createTaskSaver(write: WriteFn, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {
  // Ultima versao local de cada tarefa ainda nao confirmada pelo banco.
  const pending = new Map<string, Task>();
  const queue = new Map<string, Promise<SaveResult>>();

  async function attempt(task: Task): Promise<SaveResult> {
    for (let i = 0; ; i++) {
      // Uma edicao mais nova (ou a exclusao) da mesma tarefa assumiu.
      if (pending.get(task.id) !== task) return "superseded";
      const { error, status } = await write(task);
      const current = pending.get(task.id) === task;
      if (!error) {
        if (current) pending.delete(task.id);
        return "saved";
      }
      if (!isTransient(status)) {
        console.error("Task DB write rejected:", task.id, error);
        if (current) pending.delete(task.id);
        return "rejected";
      }
      if (i >= RETRY_DELAYS_MS.length) {
        console.error("Task DB write failed after retries, kept as pending:", task.id, error);
        return "pending";
      }
      await sleep(RETRY_DELAYS_MS[i]);
    }
  }

  function save(task: Task): Promise<SaveResult> {
    pending.set(task.id, task);
    const run = (queue.get(task.id) ?? Promise.resolve("saved" as SaveResult)).then(() => attempt(task));
    queue.set(task.id, run);
    run.finally(() => {
      if (queue.get(task.id) === run) queue.delete(task.id);
    });
    return run;
  }

  return {
    save,
    // Lista do banco + tarefas ainda nao confirmadas (a versao local vence).
    merge(fromDb: Task[]): Task[] {
      if (pending.size === 0) return fromDb;
      return [...fromDb.filter((t) => !pending.has(t.id)), ...pending.values()];
    },
    // Reenvia as pendentes paradas (chamado depois de um reload que deu certo).
    retryPending(onResult?: (task: Task, result: SaveResult) => void) {
      for (const task of [...pending.values()]) {
        if (queue.has(task.id)) continue;
        save(task).then((r) => onResult?.(task, r));
      }
    },
    // Apagar uma tarefa pendente nao pode ressuscita-la no proximo reload.
    forget(id: string) {
      pending.delete(id);
    },
    pendingCount: () => pending.size,
  };
}

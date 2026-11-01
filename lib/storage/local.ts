import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ActivityRow, FarewellStore, MessageRow } from "./types";

type State = { activity_events: ActivityRow[]; messages: MessageRow[] };
const filePath = resolve(process.cwd(), ".data/farewell.json");
let writeQueue: Promise<unknown> = Promise.resolve();

async function readState(): Promise<State> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as State;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { activity_events: [], messages: [] };
  }
}

async function mutate<T>(change: (state: State) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const state = await readState();
    const result = await change(state);
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, JSON.stringify(state), { mode: 0o600 });
    await rename(tempPath, filePath);
    return result;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

const newest = <T extends { created_at: string }>(rows: T[], limit: number) =>
  [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);

export const localStore: FarewellStore = {
  async insertActivity(row) {
    await mutate((state) => state.activity_events.push({ ...row, created_at: new Date().toISOString() }));
  },
  async insertMessage(row) {
    return mutate((state) => {
      if (state.messages.some((message) => message.id === row.id)) return false;
      state.messages.push({ ...row, email_status: "pending", created_at: new Date().toISOString() });
      return true;
    });
  },
  async getMessageEmailStatus(id) {
    return (await readState()).messages.find((message) => message.id === id)?.email_status ?? null;
  },
  async setMessageEmailStatus(id, status) {
    await mutate((state) => {
      const message = state.messages.find((item) => item.id === id);
      if (message) message.email_status = status;
    });
  },
  async listActivity(limit) { return newest((await readState()).activity_events, limit); },
  async listMessages(limit) { return newest((await readState()).messages, limit); },
  async countActivity(event) {
    return (await readState()).activity_events.filter((item) => !event || item.event === event).length;
  },
  async countMessages(predicate) {
    const messages = (await readState()).messages;
    if (predicate === "pending") return messages.filter((message) => message.email_status !== "sent").length;
    if (predicate === "fingerprints") return new Set(messages.map((message) => message.fingerprint_hash).filter(Boolean)).size;
    return messages.length;
  },
  async clear() {
    return mutate((state) => {
      const counts = { messages: state.messages.length, events: state.activity_events.length };
      state.messages = [];
      state.activity_events = [];
      return counts;
    });
  },
};

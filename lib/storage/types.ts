export type ActivityRow = {
  id: string;
  session_id: string;
  name: string;
  event: string;
  detail: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  name: string;
  surname: string;
  kind: string;
  choice: string;
  contact: string;
  message: string;
  date: string;
  session_id: string;
  fingerprint_hash: string;
  email_status: string;
  created_at: string;
};

export type NewActivity = Omit<ActivityRow, "created_at">;
export type NewMessage = Omit<MessageRow, "email_status" | "created_at">;

export interface FarewellStore {
  insertActivity(row: NewActivity): Promise<void>;
  insertMessage(row: NewMessage): Promise<boolean>;
  getMessageEmailStatus(id: string): Promise<string | null>;
  setMessageEmailStatus(id: string, status: string): Promise<void>;
  listActivity(limit: number): Promise<ActivityRow[]>;
  listMessages(limit: number): Promise<MessageRow[]>;
  countActivity(event?: string): Promise<number>;
  countMessages(predicate?: "pending" | "fingerprints"): Promise<number>;
  clear(): Promise<{ messages: number; events: number }>;
}

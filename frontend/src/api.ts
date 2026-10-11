export interface Doc {
  id: string;
  title: string;
  page_count: number;
  created_at: string;
}

export interface Thread {
  id: string;
  document_id: string;
  title: string;
  created_at: string;
}

export interface Msg {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export interface Settings {
  openrouter_model: string;
  openrouter_effort: string;
  api_key_configured: boolean;
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const listDocuments = () => fetch("/api/documents").then((r) => j<Doc[]>(r));

export const getDocument = (id: string) => fetch(`/api/documents/${id}`).then((r) => j<Doc>(r));

export async function uploadDocument(file: File, title: string): Promise<Doc> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  return fetch("/api/documents", { method: "POST", body: form }).then((r) => j<Doc>(r));
}

export const listThreads = (docId: string) =>
  fetch(`/api/threads?document_id=${docId}`).then((r) => j<Thread[]>(r));

export const createThread = (docId: string) =>
  fetch("/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: docId }),
  }).then((r) => j<Thread>(r));

export const getMessages = (threadId: string) =>
  fetch(`/api/threads/${threadId}/messages`).then((r) => j<{ role: string; content: string }[]>(r));

export const getSettings = () => fetch("/api/settings").then((r) => j<Settings>(r));

export const saveSettings = (s: { openrouter_model: string; openrouter_effort: string }) =>
  fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  }).then((r) => j<Settings>(r));

export async function askStream(
  threadId: string,
  page: number,
  text: string,
  onToken: (token: string) => void,
): Promise<void> {
  const res = await fetch(`/api/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, text }),
  });
  if (!res.ok || !res.body) throw new Error(await res.text());
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6)) as {
        type: string;
        value?: string;
      };
      if (event.type === "token") onToken(event.value ?? "");
      else if (event.type === "error") throw new Error(event.value);
    }
  }
}

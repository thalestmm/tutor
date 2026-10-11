import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { marked } from "marked";
import renderMathInElement from "katex/contrib/auto-render";
import {
  askStream,
  createThread,
  getMessages,
  getSettings,
  listThreads,
  saveSettings,
  type Msg,
  type Thread,
} from "~/api";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

marked.use({ breaks: true });

const MODELS = [
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
];

const DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "$", right: "$", display: false },
  { left: "\\(", right: "\\)", display: false },
];

function mdHtml(text: string): string {
  return marked.parse(text, { breaks: true }) as string;
}

interface BubbleProps {
  msg: Msg;
  onGrow: () => void;
}

function Bubble(props: BubbleProps) {
  let el!: HTMLDivElement;
  createEffect(
    on(
      () => props.msg.content,
      (content) => {
        el.innerHTML = mdHtml(content);
        if (/[$\\]/.test(content)) {
          renderMathInElement(el, { delimiters: DELIMITERS, throwOnError: false });
        }
        props.onGrow();
      },
      { defer: true },
    ),
  );
  return (
    <div
      ref={el}
      class={cn(
        "max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        props.msg.role === "user"
          ? "self-end bg-sky-900/60"
          : "self-start border bg-card",
        props.msg.streaming && "opacity-80",
      )}
      innerHTML={mdHtml(props.msg.content)}
    />
  );
}

interface ChatProps {
  docId: string;
  docTitle: string;
  currentPage: () => number;
}

export default function Chat(props: ChatProps) {
  const [threads, setThreads] = createSignal<Thread[]>([]);
  const [threadId, setThreadId] = createSignal<string | null>(null);
  const [messages, setMessages] = createSignal<Msg[]>([]);
  const [input, setInput] = createSignal("");
  const [streaming, setStreaming] = createSignal(false);
  const [model, setModel] = createSignal("");
  const [effort, setEffort] = createSignal("medium");
  const [apiKeyOk, setApiKeyOk] = createSignal(true);
  const [modelReady, setModelReady] = createSignal(false);
  let listEl!: HTMLDivElement;
  let inputEl!: HTMLTextAreaElement;

  function scrollToBottom() {
    listEl.scrollTop = listEl.scrollHeight;
  }

  onMount(async () => {
    const s = await getSettings();
    setModel(s.openrouter_model);
    setEffort(s.openrouter_effort);
    setApiKeyOk(s.api_key_configured);
    setModelReady(true);
    await loadThreads();
  });

  async function loadThreads() {
    const ts = await listThreads(props.docId);
    setThreads(ts);
    if (ts.length > 0) {
      setThreadId(ts[0].id);
      setMessages(
        (await getMessages(ts[0].id)).map((m) => ({
          role: m.role as Msg["role"],
          content: m.content,
        })),
      );
    } else {
      setThreadId(null);
      setMessages([]);
    }
  }

  async function switchThread(id: string) {
    setThreadId(id);
    setMessages(
      (await getMessages(id)).map((m) => ({
        role: m.role as Msg["role"],
        content: m.content,
      })),
    );
    scrollToBottom();
  }

  async function newThread() {
    const t = await createThread(props.docId);
    await loadThreads();
    setThreadId(t.id);
    setMessages([]);
  }

  async function saveModelSettings() {
    if (!modelReady()) return;
    await saveSettings({ openrouter_model: model(), openrouter_effort: effort() });
  }

  const submit = async (e?: Event) => {
    e?.preventDefault();
    if (streaming()) return;
    const text = input().trim();
    if (!text) return;
    setStreaming(true);
    try {
      let tid = threadId();
      if (!tid) {
        tid = (await createThread(props.docId)).id;
        setThreadId(tid);
        setThreads(await listThreads(props.docId));
        setMessages([]);
      }
      setMessages((m) => [...m, { role: "user", content: text }]);
      setMessages((m) => [...m, { role: "assistant", content: "", streaming: true }]);
      setInput("");
      scrollToBottom();

      let acc = "";
      let lastPaint = 0;
      await askStream(tid, props.currentPage(), text, (token) => {
        acc += token;
        const now = performance.now();
        if (now - lastPaint > 80) {
          lastPaint = now;
          const snapshot = acc;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: snapshot, streaming: true };
            return copy;
          });
        }
      });
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: acc };
        return copy;
      });
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      inputEl?.focus();
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  onCleanup(() => {
    // nothing persistent
  });

  return (
    <aside class="flex w-[440px] shrink-0 flex-col border-l bg-card">
      <div class="flex items-center gap-2 border-b px-2 py-2">
        <Select
          class="h-8 min-w-0 flex-1 flex-1"
          value={threadId() ?? ""}
          onChange={(e) => void switchThread(e.currentTarget.value)}
          aria-label="Conversation"
        >
          <Show when={threads().length === 0}>
            <option value="">New conversation…</option>
          </Show>
          <For each={threads()}>{(t) => <option value={t.id}>{t.title}</option>}</For>
        </Select>
        <Button variant="secondary" size="sm" onClick={() => void newThread()}>
          New
        </Button>
      </div>

      <div class="flex gap-2 border-b px-2 py-2">
        <Select
          class="h-8 min-w-0 flex-1 text-xs"
          value={model()}
          onChange={(e) => {
            setModel(e.currentTarget.value);
            void saveModelSettings();
          }}
          aria-label="Model"
        >
          <Show when={model() && !MODELS.includes(model())}>
            <option value={model()}>{model()}</option>
          </Show>
          <For each={MODELS}>{(m) => <option value={m}>{m}</option>}</For>
        </Select>
        <Select
          class="h-8 text-xs"
          value={effort()}
          onChange={(e) => {
            setEffort(e.currentTarget.value);
            void saveModelSettings();
          }}
          aria-label="Effort"
        >
          <option value="none">no reasoning</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </Select>
      </div>

      <Show when={!apiKeyOk()}>
        <p class="mx-2 mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          OPENROUTER_API_KEY is not set — chat will not work.
        </p>
      </Show>

      <div ref={listEl} class="messages flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        <For each={messages()}>{(msg) => <Bubble msg={msg} onGrow={scrollToBottom} />}</For>
      </div>

      <form class="flex items-end gap-2 border-t p-3" onSubmit={submit}>
        <Textarea
          ref={inputEl}
          rows={2}
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={onKey}
          placeholder="Ask about this page… (Enter to send, Shift+Enter for newline)"
          class="max-h-40 resize-none"
        />
        <Button type="submit" disabled={streaming()}>
          {streaming() ? "…" : "Send"}
        </Button>
      </form>
    </aside>
  );
}

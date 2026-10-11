import { createSignal, For, Show, type JSX } from "solid-js";
import { uploadDocument, type Doc, listDocuments } from "~/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function Library() {
  const [docs, setDocs] = createSignal<Doc[] | null>(null);
  const [title, setTitle] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let fileInput!: HTMLInputElement;

  const load = () => listDocuments().then(setDocs);
  void load();

  const submit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
    e.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const doc = await uploadDocument(file, title());
      window.location.href = `/read/${doc.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <main class="mx-auto max-w-2xl px-4 py-12">
      <h1 class="text-3xl font-semibold tracking-tight">Tutor</h1>
      <p class="mt-1 text-muted-foreground">Your study library</p>

      <form class="mt-8 flex gap-2" onSubmit={submit}>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          required
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-0.5 file:text-xs file:text-secondary-foreground"
        />
        <Input
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          placeholder="Title (optional)"
          class="max-w-56"
        />
        <Button type="submit" disabled={busy()}>
          {busy() ? "Uploading…" : "Open"}
        </Button>
      </form>
      <Show when={error()}>
        <p class="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error()}
        </p>
      </Show>

      <div class="mt-8 flex flex-col gap-2">
        <Show when={docs()} fallback={<p class="text-muted-foreground">Loading…</p>}>
          {(list) => (
            <Show
              when={list().length > 0}
              fallback={<p class="text-muted-foreground">No documents yet. Upload a PDF to get started.</p>}
            >
              <For each={list()}>
                {(doc) => (
                  <a
                    href={`/read/${doc.id}`}
                    class="rounded-lg border bg-card px-4 py-3 shadow-sm transition-colors hover:border-ring"
                  >
                    <span class="block font-medium">{doc.title}</span>
                    <span class="text-xs text-muted-foreground">
                      {doc.page_count} pages · {doc.created_at}
                    </span>
                  </a>
                )}
              </For>
            </Show>
          )}
        </Show>
      </div>
    </main>
  );
}

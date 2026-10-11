import { createResource, createSignal, Show } from "solid-js";
import { getDocument } from "~/api";
import Chat from "~/components/Chat";
import PdfViewer from "~/components/PdfViewer";

export default function Reader(props: { docId: string }) {
  const [doc] = createResource(() => props.docId, (id) => getDocument(id));
  const [currentPage, setCurrentPage] = createSignal(1);

  return (
    <Show
      when={doc()}
      fallback={
        <div class="flex h-screen items-center justify-center text-muted-foreground">
          Loading document…
        </div>
      }
    >
      {(d) => (
        <div class="flex h-screen">
          <PdfViewer docId={props.docId} pageCount={d().page_count} onPageChange={setCurrentPage} />
          <Chat
            docId={props.docId}
            docTitle={d().title}
            currentPage={currentPage}
          />
        </div>
      )}
    </Show>
  );
}

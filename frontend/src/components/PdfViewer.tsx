import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const GAP = 16; // px between pages (keep in sync with .pages gap below)
const TOP_PAD = 16; // .pages padding-top
const BUFFER = 1000; // px pre-render margin around the viewport
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

interface Dim {
  w: number;
  h: number;
}

interface Props {
  docId: string;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export default function PdfViewer(props: Props) {
  let wrap!: HTMLDivElement;
  let pagesEl!: HTMLDivElement;
  const pageEls: HTMLDivElement[] = [];

  const [pages, setPages] = createSignal<Dim[]>([]);
  const [scale, setScale] = createSignal(1);
  const [zoomPct, setZoomPct] = createSignal("");
  const [status, setStatus] = createSignal("Loading document…");
  const [pageValue, setPageValue] = createSignal(1);

  let pdf: pdfjsLib.PDFDocumentProxy | null = null;
  let dims: Dim[] = [];
  let offsets: number[] = [];
  let userZoomed = false;
  let generation = 0;
  let current = 1;
  const rendered = new Map<number, { canvas: HTMLCanvasElement | null }>();

  const dpr = () => window.devicePixelRatio || 1;
  const pageHeight = (i: number) => Math.round(dims[i].h * scale());
  const pageWidth = (i: number) => Math.round(dims[i].w * scale());
  const topOf = (i: number) => offsets[i] + TOP_PAD;

  function computeOffsets() {
    offsets = new Array(dims.length + 1).fill(0);
    for (let i = 0; i < dims.length; i++) {
      offsets[i + 1] = offsets[i] + pageHeight(i) + GAP;
    }
  }

  function clearRendered() {
    generation++;
    for (const { canvas } of rendered.values()) canvas?.remove();
    rendered.clear();
  }

  async function renderPage(n: number, gen: number) {
    if (rendered.has(n)) return;
    rendered.set(n, { canvas: null });
    const pg = await pdf!.getPage(n);
    if (gen !== generation) {
      rendered.delete(n);
      return;
    }
    const vp = pg.getViewport({ scale: scale() * dpr() });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    canvas.style.width = `${Math.round(vp.width / dpr())}px`;
    canvas.style.height = `${Math.round(vp.height / dpr())}px`;
    rendered.set(n, { canvas });
    pageEls[n - 1].replaceChildren(canvas);
    const task = pg.render({ canvasContext: canvas.getContext("2d")!, viewport: vp });
    await task.promise;
    if (gen !== generation) {
      canvas.remove();
      rendered.delete(n);
    }
  }

  function unrender(n: number) {
    const entry = rendered.get(n);
    if (!entry) return;
    entry.canvas?.remove();
    rendered.delete(n);
  }

  async function ensureRendered() {
    if (!pdf || dims.length === 0) return;
    const top = wrap.scrollTop;
    const bottom = top + wrap.clientHeight;
    const gen = generation;
    const wanted: number[] = [];
    for (let i = 0; i < dims.length; i++) {
      const pTop = topOf(i);
      const pBottom = pTop + pageHeight(i);
      if (pBottom >= top - BUFFER && pTop <= bottom + BUFFER) {
        wanted.push(i + 1);
      } else if (rendered.has(i + 1)) {
        unrender(i + 1);
      }
    }
    await Promise.all(
      wanted.map((n) =>
        renderPage(n, gen).catch((err) => {
          rendered.delete(n);
          if (err?.name !== "RenderingCancelledException") console.error(err);
        }),
      ),
    );
  }

  function pageAt(y: number): number {
    let lo = 0;
    let hi = dims.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (topOf(mid) <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  function scrollToPage(n: number, center = false) {
    const page = Math.min(Math.max(1, n), dims.length);
    const y = center
      ? topOf(page - 1) - (wrap.clientHeight - pageHeight(page - 1)) / 2
      : topOf(page - 1);
    wrap.scrollTo({ top: Math.max(0, y) });
  }

  function updateCurrentPage() {
    if (dims.length === 0) return;
    current = pageAt(wrap.scrollTop + wrap.clientHeight / 2);
    setPageValue(current);
    props.onPageChange(current);
  }

  // Reactive relayout: runs on initial load and whenever zoom changes.
  createEffect(() => {
    if (pages().length === 0) return;
    scale();
    computeOffsets();
    clearRendered();
    requestAnimationFrame(() => {
      scrollToPage(current, true);
      updateCurrentPage();
      ensureRendered();
    });
  });

  function setZoom(next: number) {
    userZoomed = true;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
    setZoomPct(`${Math.round(scale() * 100)}%`);
  }

  function fitWidth() {
    if (dims.length === 0) return;
    const maxW = Math.max(...dims.map((d) => d.w));
    setScale((wrap.clientWidth - 48) / maxW);
    setZoomPct(`${Math.round(scale() * 100)}%`);
  }

  function jump(n: number) {
    scrollToPage(n, true);
    updateCurrentPage();
    ensureRendered();
  }

  onMount(async () => {
    pdf = await pdfjsLib.getDocument(`/api/documents/${props.docId}/pdf`).promise;
    dims = await Promise.all(
      Array.from({ length: props.pageCount }, async (_, i) => {
        const pg = await pdf!.getPage(i + 1);
        const vp = pg.getViewport({ scale: 1 });
        return { w: vp.width, h: vp.height };
      }),
    );
    fitWidth();
    setPages(dims);
    setStatus("");
  });

  const onScroll = () => {
    updateCurrentPage();
    ensureRendered();
  };

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(scale() * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof Element && e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      jump(current - 1);
    } else if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      jump(current + 1);
    }
  };

  let resizeTimer: ReturnType<typeof setTimeout>;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!userZoomed) fitWidth();
    }, 200);
  };

  onMount(() => {
    wrap.addEventListener("scroll", onScroll, { passive: true });
    wrap.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
  });

  onCleanup(() => {
    wrap?.removeEventListener("scroll", onScroll);
    wrap?.removeEventListener("wheel", onWheel);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
  });

  return (
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center gap-4 border-b bg-card px-3 py-2">
        <a href="/" class="text-sm text-muted-foreground hover:text-foreground">
          ← Library
        </a>
        <div class="ml-auto flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" title="Previous page (←)" onClick={() => jump(current - 1)}>
              ←
            </Button>
            <Input
              type="number"
              min={1}
              max={props.pageCount}
              value={pageValue()}
              onChange={(e) => jump(parseInt(e.currentTarget.value, 10) || 1)}
              class="h-8 w-16"
            />
            <span class="text-sm text-muted-foreground">/ {props.pageCount}</span>
            <Button variant="ghost" size="icon" title="Next page (→)" onClick={() => jump(current + 1)}>
              →
            </Button>
          </div>
          <div class="flex items-center gap-1.5 text-muted-foreground">
            <Button variant="ghost" size="icon" title="Zoom out (Ctrl+scroll)" onClick={() => setZoom(scale() / 1.25)}>
              −
            </Button>
            <span class="w-12 text-center text-xs tabular-nums">{zoomPct()}</span>
            <Button variant="ghost" size="icon" title="Zoom in (Ctrl+scroll)" onClick={() => setZoom(scale() * 1.25)}>
              +
            </Button>
          </div>
        </div>
      </div>

      <div ref={wrap} class="relative flex-1 overflow-auto">
        <div ref={pagesEl} class="mx-auto flex flex-col items-center gap-4 py-4">
          <For each={pages()}>
            {(_, i) => (
              <div
                ref={(el) => (pageEls[i()] = el)}
                class="page shrink-0 overflow-hidden rounded bg-white shadow-lg"
                style={{ width: `${pageWidth(i())}px`, height: `${pageHeight(i())}px` }}
              />
            )}
          </For>
        </div>
        <Show when={status()}>
          <div class="absolute left-1/2 top-3 -translate-x-1/2 rounded-md border bg-card px-3 py-1 text-sm text-muted-foreground shadow">
            {status()}
          </div>
        </Show>
      </div>
    </div>
  );
}

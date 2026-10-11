declare module "katex/contrib/auto-render" {
  interface AutoRenderOptions {
    delimiters?: { left: string; right: string; display: boolean }[];
    throwOnError?: boolean;
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (msg: string, err: Error) => void;
  }
  export default function renderMathInElement(el: HTMLElement, options?: AutoRenderOptions): void;
}

import { splitProps, type JSX, type ParentComponent } from "solid-js";
import { cn } from "~/lib/utils";

type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea: ParentComponent<TextareaProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <textarea
      class={cn(
        "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </textarea>
  );
};

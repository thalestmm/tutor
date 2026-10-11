import { splitProps, type JSX, type ParentComponent } from "solid-js";
import { cn } from "~/lib/utils";

type InputProps = JSX.InputHTMLAttributes<HTMLInputElement>;

export const Input: ParentComponent<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <input
      class={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </input>
  );
};

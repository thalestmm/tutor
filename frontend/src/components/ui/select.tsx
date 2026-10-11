import { splitProps, type JSX, type ParentComponent } from "solid-js";
import { cn } from "~/lib/utils";

type SelectProps = JSX.SelectHTMLAttributes<HTMLSelectElement>;

export const Select: ParentComponent<SelectProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <select
      class={cn(
        "h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </select>
  );
};

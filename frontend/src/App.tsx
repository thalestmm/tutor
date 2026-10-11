import { Match, Switch } from "solid-js";
import Library from "~/components/Library";
import Reader from "~/components/Reader";

const match = window.location.pathname.match(/^\/read\/([0-9a-f]+)/);

export default function App() {
  return (
    <Switch>
      <Match when={match}>
        <Reader docId={match![1]} />
      </Match>
      <Match when={true}>
        <Library />
      </Match>
    </Switch>
  );
}

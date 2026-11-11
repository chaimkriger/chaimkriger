// Tiny global toast bus (client only). <Toaster /> in the root layout listens.
export interface ToastMessage {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

type Listener = (t: ToastMessage) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function toast(kind: ToastMessage["kind"], text: string) {
  const t = { id: nextId++, kind, text };
  listeners.forEach((l) => l(t));
}

export function onToast(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

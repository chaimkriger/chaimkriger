// Button styling shared by server and client components.
import { cx } from "./ui";

export const BUTTON = {
  base: "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
  size: { sm: "h-8 px-3 text-[0.8rem]", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" },
  variant: {
    primary: "bg-inverse text-inverse-ink hover:opacity-90",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-raised",
    danger: "border border-notready/40 bg-surface text-notready-ink hover:bg-notready-soft",
    ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
    ready: "bg-ready text-white hover:opacity-90",
  },
};

export function buttonClass(variant: keyof typeof BUTTON.variant = "secondary", size: keyof typeof BUTTON.size = "sm", extra = "") {
  return cx(BUTTON.base, BUTTON.size[size], BUTTON.variant[variant], extra);
}


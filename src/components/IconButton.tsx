"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label?: string;
};

export function IconButton({ children, label, className = "", ...props }: Props) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-[12px] px-2.5 py-2 text-ink-soft transition-colors hover:bg-white/5 hover:text-sand disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

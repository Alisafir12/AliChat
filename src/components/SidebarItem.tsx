"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  active?: boolean;
};

export function SidebarItem({
  children,
  active = false,
  className = "",
  ...props
}: Props) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-start text-[14px] transition-all ${
        active
          ? "bg-sand/15 text-sand"
          : "text-ink-soft hover:bg-white/5 hover:text-ink"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

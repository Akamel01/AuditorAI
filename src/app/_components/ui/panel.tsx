import type { ComponentProps, ReactNode } from "react";

export function Panel({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & ComponentProps<"div"> & { as?: "div" | "section" | "article" | "aside" }) {
  return (
    <Tag className={`rounded-md border border-hairline bg-surface ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

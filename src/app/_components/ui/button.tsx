import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Spinner } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-[color:var(--accent-contrast)] border border-transparent hover:bg-accent-strong disabled:hover:bg-accent",
  secondary:
    "bg-surface text-text border border-edge hover:border-faint hover:bg-sunken disabled:hover:border-edge disabled:hover:bg-surface",
  ghost: "bg-transparent text-muted border border-transparent hover:text-text hover:bg-sunken",
  danger:
    "bg-transparent text-concern border border-transparent hover:bg-concern-tint hover:border-concern-line",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px] gap-1.5 rounded-[5px]",
  md: "h-9 px-4 text-[13.5px] gap-2 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, disabled, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer select-none items-center justify-center font-medium leading-none transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(.2,0,0,1)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
});

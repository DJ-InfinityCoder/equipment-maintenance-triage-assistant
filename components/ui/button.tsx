import Link from "next/link";
import type { ComponentProps } from "react";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline" | "ghost";
type ButtonSize = "sm" | "default" | "lg";

interface ButtonVariantOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const variants: Record<ButtonVariant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  outline:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-md px-3 text-sm",
  default: "h-10 rounded-md px-4 py-2 text-sm",
  lg: "h-11 rounded-md px-5 text-sm",
};

export function buttonVariants({
  variant = "default",
  size = "default",
  className = "",
}: ButtonVariantOptions = {}) {
  return [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariantOptions) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: Omit<ComponentProps<typeof Link>, "className"> & ButtonVariantOptions) {
  return (
    <Link
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

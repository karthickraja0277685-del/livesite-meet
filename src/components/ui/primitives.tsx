import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper function standard in shadcn/ui to merge Tailwind classes cleanly
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "glass" | "danger" | "outline";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-white text-black hover:bg-neutral-200 font-medium",
    glass:
      "bg-white/10 text-white border border-white/15 backdrop-blur-md hover:bg-white/15",
    danger: "bg-red-600 text-white hover:bg-red-500 font-medium",
    outline: "border border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/30",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function Card({
  className,
  children
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-neutral-900/80 backdrop-blur-md p-6 text-white shadow-xl",
        className
      )}
    >
      {children}
    </div>
  );
}
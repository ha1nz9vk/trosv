import * as React from "react";
import { cn } from "@/lib/utils";

/*
  TROSV inputs: 48px fields on white, 1px strong line, clay focus ring,
  12px radius, Noto Sans.
*/

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border bg-white px-4 text-base text-ink",
        "placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors duration-150 ease-out",
        invalid ? "border-destructive" : "border-line-strong",
        className
      )}
      ref={ref}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-xl border bg-white p-4 text-base text-ink",
        "placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid ? "border-destructive" : "border-line-strong",
        className
      )}
      ref={ref}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Input, Textarea };

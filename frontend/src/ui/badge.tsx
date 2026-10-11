import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/* Tag: neutral cream pill on top of a photo placeholder. */
const tagVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        cream: "bg-cream text-ink",
        oat: "bg-oat text-ink",
        outline: "border border-line-strong bg-transparent text-ink",
      },
    },
    defaultVariants: { variant: "cream" },
  }
);

export interface TagProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof tagVariants> {}

export function Tag({ className, variant, ...props }: TagProps) {
  return <span className={cn(tagVariants({ variant }), className)} {...props} />;
}

/* Chip: interactive filter pill; `on` = selected state (ink fill). */
export interface ChipProps extends React.ComponentProps<"button"> {
  on?: boolean;
}

export function Chip({ className, on, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2",
        on
          ? "border-ink bg-ink text-white hover:bg-ink-2"
          : "border-line-strong bg-transparent text-ink hover:bg-ivory",
        "disabled:opacity-50",
        className
      )}
      aria-pressed={on}
      {...props}
    />
  );
}

/* Unread-count badge: clay fill, cream text. */
export function Badge({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-clay px-1.5 font-sans text-xs font-bold leading-5 text-black",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* Skeleton: slow opacity pulse mirroring the real layout. */
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-oat",
        className
      )}
      aria-hidden
      {...props}
    />
  );
}

/* Star rating: 1..5 (supports halves for display only). */
export function Rating({
  value,
  count,
  className,
}: {
  value: number | null | undefined;
  count?: number | null | undefined;
  className?: string;
}) {
  const v = value ?? 0;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm", className)}
      aria-label={
        count != null && count > 0
          ? `${v.toFixed(1)} trên 5 sao, ${count} đánh giá`
          : `${v.toFixed(1)} trên 5 sao`
      }
    >
      <Star className="size-4 fill-ink stroke-ink" aria-hidden />
      <span className="tabular-nums text-ink-2">
        {value == null ? "Chưa có đánh giá" : v.toFixed(1)}
      </span>
      {count != null && count > 0 ? (
        <span className="tabular-nums text-muted">({count})</span>
      ) : null}
    </span>
  );
}

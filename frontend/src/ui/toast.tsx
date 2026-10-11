import { Toaster as Sonner } from "sonner";

/*
  Toast: bottom-centre, ink on cream, 4s, aria-live handled by Sonner.
  Appears above the mobile tab bar.
*/

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      duration={4000}
      style={{
        fontFamily: "var(--font-sans)",
      }}
      toastOptions={{
        classNames: {
          toast:
            "!bg-ink !text-cream !border-ink !rounded-xl !shadow-none !text-sm",
          description: "!text-cream/80",
          actionButton: "!bg-cream !text-ink !rounded-lg !font-medium",
        },
      }}
    />
  );
}

export { toast } from "sonner";

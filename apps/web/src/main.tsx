import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./styles.css";

import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import { Toaster } from "@/ui/toast";

function Root() {
  return (
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
        <Toaster />
      </Providers>
    </StrictMode>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root mount element");
createRoot(rootEl).render(<Root />);

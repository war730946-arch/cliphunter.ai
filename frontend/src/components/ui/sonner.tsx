"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: "rgb(39 39 42)",
          border: "1px solid rgb(63 63 70)",
          color: "white",
          borderRadius: "12px",
        },
      }}
      closeButton
      richColors
    />
  );
}

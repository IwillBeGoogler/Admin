import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { I18nProvider } from "@/shared/i18n";
import { ThemeProvider, useTheme } from "@/shared/ui/theme";

function ThemedToaster() {
  const { theme } = useTheme();
  // Bottom-right keeps the header toolbar clear; errors opt into duration: Infinity (shared/lib/notify).
  return <Toaster theme={theme} richColors closeButton position="bottom-right" duration={4000} />;
}

export function Providers({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          {children}
          <ThemedToaster />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

import { Outlet, ScrollRestoration } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { ThemeInitializer } from '@/components/layout/ThemeInitializer';

export default function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-broker-dark text-broker-text">
      <ScrollRestoration />
      <ThemeInitializer />
      <Outlet />
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        className="z-[100]"
      />
    </div>
  );
}

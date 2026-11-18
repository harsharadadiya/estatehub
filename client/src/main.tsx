import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/misc';
import { muiTheme } from '@/theme/muiTheme';
import { isApiError } from '@/lib/api';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Do not retry "not found" or "not allowed" – only network/server problems
      retry: (count, error) => count < 2 && (!isApiError(error) || error.status === 0 || error.status >= 500),
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* enableCssLayer puts MUI styles in @layer mui, so Tailwind classes can override them */}
    <StyledEngineProvider enableCssLayer>
      <ThemeProvider theme={muiTheme}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>
);

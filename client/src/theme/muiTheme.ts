// Material UI theme matched to the same colors and font as Tailwind / shadcn (see index.css)
import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  palette: {
    primary: { main: '#1F5F5B', contrastText: '#ffffff' },
    secondary: { main: '#16233B' },
    warning: { main: '#F2A007' },
    error: { main: '#C2410C' },
    success: { main: '#15803D' },
    text: { primary: '#16233B', secondary: '#5B6670' },
    background: { default: '#F7F8F6', paper: '#ffffff' },
    divider: '#DDE3DF',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiTab: { styleOverrides: { root: { fontWeight: 600, minHeight: 44, fontSize: 15 } } },
    MuiSkeleton: { defaultProps: { animation: 'wave' } },
    MuiToggleButton: { styleOverrides: { root: { fontWeight: 600, textTransform: 'none', fontSize: 14 } } },
    MuiSlider: { styleOverrides: { thumb: { width: 20, height: 20, backgroundColor: '#fff', border: '2px solid currentColor' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
  },
});

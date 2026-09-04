/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import '@mui/material/Stack';
import type { CSSProperties } from 'react';

declare module '@mui/material/Stack' {
  interface StackOwnProps {
    alignItems?: CSSProperties['alignItems'];
    justifyContent?: CSSProperties['justifyContent'];
  }
}

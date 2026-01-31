// Expertly Manage - Task Management Application
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@expertly/ui'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'   // <— instead of '../style.css' or similar

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PinGate from './components/PinGate'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PinGate>
      <App />
    </PinGate>
  </React.StrictMode>,
)

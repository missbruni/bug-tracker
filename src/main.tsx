import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PinGate from './components/PinGate'
import NavBar from './components/NavBar'
import SessionsListPage from './pages/SessionsListPage'
import SessionSetupPage from './pages/SessionSetupPage'
import PresentationPage from './pages/PresentationPage'
import TesterManagementPage from './pages/TesterManagementPage'
import './index.css'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans">
      <NavBar />
      {children}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PinGate>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/sessions" element={<Layout><SessionsListPage /></Layout>} />
          <Route path="/sessions/:id" element={<Layout><SessionSetupPage /></Layout>} />
          <Route path="/sessions/:id/present" element={<PresentationPage />} />
          <Route path="/testers" element={<Layout><TesterManagementPage /></Layout>} />
        </Routes>
      </HashRouter>
    </PinGate>
  </React.StrictMode>,
)

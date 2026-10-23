import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import DocumentRegistry from './components/DocumentRegistry'
import ScanIngestion from './components/ScanIngestion'
import SecondBrainChat from './components/SecondBrainChat'
import { fetchStats } from './api'

function App() {
  const [activeTab, setActiveTab] = useState('registry') // 'registry' | 'scan' | 'chat'
  const [provider, setProvider] = useState('gemini') // 'gemini' | 'openai'
  const [stats, setStats] = useState(null)

  // Quản lý chế độ giao diện: Mặc định là 'light' (văn phòng), lưu tại localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('docuvault_theme')
    return saved ? saved : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('docuvault_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  const loadStats = async () => {
    try {
      const data = await fetchStats()
      setStats(data)
    } catch (err) {
      console.warn('Chưa kết nối backend stats:', err.message)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none transition-colors duration-200">
      {/* Thanh điều hướng Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        provider={provider}
        setProvider={setProvider}
        stats={stats}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Khu vực nội dung chính */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeTab === 'registry' && (
          <DocumentRegistry
            stats={stats}
            refreshStats={loadStats}
            onNavigateScan={() => setActiveTab('scan')}
          />
        )}

        {activeTab === 'scan' && (
          <ScanIngestion
            provider={provider}
            onScanSuccess={() => {
              loadStats()
              setActiveTab('registry')
            }}
          />
        )}

        {activeTab === 'chat' && (
          <SecondBrainChat
            provider={provider}
          />
        )}
      </main>
    </div>
  )
}

export default App

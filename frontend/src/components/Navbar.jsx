import React from 'react'
import {
  FileText,
  Upload,
  Brain,
  Shield,
  Sparkles,
  Sun,
  Moon,
  CheckCircle2
} from 'lucide-react'

export default function Navbar({
  activeTab,
  setActiveTab,
  provider,
  setProvider,
  stats,
  theme,
  toggleTheme,
}) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 px-6 py-3 flex items-center justify-between shadow-xs transition-colors duration-200">
      {/* Brand & Office Identity */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              DocuVault
            </h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              Văn Phòng Số
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Second Brain Obsidian: <strong className="font-semibold text-slate-700 dark:text-slate-200">Đã đồng bộ</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'registry'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Sổ Văn Bản</span>
          {stats?.total_documents !== undefined && (
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'registry'
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {stats.total_documents}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('scan')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'scan'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Quét & Nạp Scan AI</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'chat'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900'
          }`}
        >
          <Brain className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          <span>Trợ Lý Tri Thức</span>
        </button>
      </nav>

      {/* Right Controls: Provider & Theme Toggle */}
      <div className="flex items-center gap-2.5">
        {/* Model AI Selector */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">AI:</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-transparent text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="gemini" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              Gemini 2.5 Flash
            </option>
            <option value="openai" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
              OpenAI GPT-4o-mini
            </option>
          </select>
        </div>

        {/* Theme Switcher: Light (Default) / Dark (Dash mode) */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Chuyển sang Chế độ Tối (Dash mode)' : 'Chuyển sang Chế độ Sáng (Văn phòng)'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors text-xs font-semibold cursor-pointer"
        >
          {theme === 'light' ? (
            <>
              <Sun className="w-4 h-4 text-amber-500" />
              <span className="hidden md:inline">Giao diện Sáng</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-400" />
              <span className="hidden md:inline">Giao diện Tối</span>
            </>
          )}
        </button>
      </div>
    </header>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import {
  Brain,
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  Search,
  ListTodo,
  FileText
} from 'lucide-react'
import { sendChatMessage } from '../api'

const SUGGESTED_PROMPTS = [
  '🔍 Tra cứu các văn bản hành chính mới nhất trong kho',
  '📋 Tổng hợp toàn bộ các đầu việc cần làm (Action Items)',
  '🏛️ Có văn bản nào do cơ quan UBND hoặc Văn phòng Chính phủ ban hành?',
  '💡 Tìm và đọc tóm tắt các quyết định liên quan đến công nghệ',
]

export default function SecondBrainChat({ provider }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Xin chào! Tôi là Trợ lý Tri thức Doanh nghiệp (DocuVault Second Brain AI).\n\nTôi đã được kết nối trực tiếp với Sổ văn bản lưu trữ và toàn bộ ghi chú Obsidian Vault. Bạn cần tôi tra cứu văn bản nào, tổng hợp các chỉ đạo hành động, hay đọc tóm tắt nội dung hôm nay?'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)

  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (textToSend) => {
    const text = textToSend || input
    if (!text.trim() || isLoading) return

    const userMsg = text.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)

    try {
      const data = await sendChatMessage(userMsg, provider)
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ Lỗi kết nối trợ lý AI: ${err.message || 'Không thể phản hồi lúc này.'}` }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="flex-1 flex flex-col h-full max-w-5xl mx-auto w-full p-6 overflow-hidden">
      {/* Chat Container */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xs">
        {/* Chat Header */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Trợ Lý Tri Thức DocuVault
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Second Brain AI
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tra cứu Sổ văn bản • Truy vấn Obsidian Vault • Tự động hóa công việc hành chính
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
            <span>Model:</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold uppercase">{provider}</span>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/40 dark:bg-slate-950/40">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`relative max-w-[85%] rounded-2xl p-4 shadow-xs text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
              }`}>
                <div className="whitespace-pre-wrap select-text">{msg.content}</div>

                {msg.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(msg.content, idx)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                    title="Sao chép câu trả lời"
                  >
                    {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700 flex items-center justify-center text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-slate-500 flex items-center gap-2">
                <span>AI đang tìm kiếm trong Sổ văn bản và Second Brain...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        {messages.length <= 2 && (
          <div className="px-6 pb-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-950">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="text-xs px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all text-left shadow-xs cursor-pointer font-medium"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-end gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus-within:border-blue-500 rounded-2xl p-2.5 transition-colors">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi tra cứu, yêu cầu tóm tắt hoặc kiểm tra nhiệm vụ... (Nhấn Enter để gửi)"
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none p-1.5 leading-relaxed"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl transition-all shadow-xs flex-shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'

function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'jarvis',
      content: 'Xin chào! Tôi là Jarvis. Trí nhớ Obsidian đã được kết nối. Tôi có thể giúp gì cho bạn hôm nay?'
    }
  ])
  const [provider, setProvider] = useState('gemini')  // Hoặc 'openai'
  const [isLoading, setIsLoading] = useState(false)

  const chatEndRef = useRef(null)

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = input
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      // Tự động nhận diện API URL nếu VITE_API_URL trống hoặc không khớp, fallback về hostname hiện tại của trình duyệt
      const rawApiUrl = import.meta.env.VITE_API_URL
      const apiBaseUrl = (rawApiUrl && rawApiUrl !== '__VITE_API_URL__')
        ? rawApiUrl
        : `${window.location.protocol}//${window.location.hostname}:8000`

      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, provider: provider })
      })

      if (!response.ok) {
        let errorMessage = 'Lỗi từ máy chủ AI.'
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch (e) {
          try {
            const textData = await response.text()
            if (textData) errorMessage = textData
          } catch (_) {}
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setMessages(prev => [...prev, { role: 'jarvis', content: data.response }])
    } catch (error) {
      console.error('Lỗi kết nối:', error)
      setMessages(prev => [...prev, { role: 'jarvis', content: `Lỗi: ${error.message || 'Không thể kết nối tới máy chủ AI.'}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-screen w-full max-w-4xl mx-auto bg-obsidian-dark shadow-2xl overflow-hidden">

      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-obsidian-panel border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <h1 className="text-xl font-bold tracking-wide text-gray-100">Jarvis OS</h1>
        </div>

        {/* Lựa chọn Provider */}
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="bg-obsidian-dark text-sm border border-gray-600 rounded-md px-3 py-1.5 focus:outline-none focus:border-obsidian-accent transition-colors"
        >
          <option value="openai">Brain: OpenAI</option>
          <option value="gemini">Brain: Gemini</option>
        </select>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user'
                ? 'bg-obsidian-accent text-white rounded-br-none'
                : 'bg-obsidian-panel text-gray-200 border border-gray-700/50 rounded-bl-none'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-obsidian-panel border border-gray-700/50 text-gray-400 rounded-2xl rounded-bl-none p-4 flex gap-2 items-center">
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-obsidian-panel border-t border-gray-700/50">
        <div className="flex items-end gap-2 bg-obsidian-dark rounded-xl border border-gray-600 focus-within:border-obsidian-accent p-2 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ra lệnh cho Jarvis hoặc tạo ghi chú mới..."
            className="flex-1 max-h-32 bg-transparent text-gray-100 placeholder-gray-500 resize-none outline-none p-2 text-sm md:text-base"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-obsidian-accent hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <div className="text-center mt-2 text-xs text-gray-500">
          Nhấn Enter để gửi, Shift + Enter để xuống dòng
        </div>
      </footer>
    </div>
  )
}

export default App

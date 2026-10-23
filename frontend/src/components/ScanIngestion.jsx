import React, { useState, useRef } from 'react'
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Building,
  User,
  Calendar,
  ListTodo,
  Layers,
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  Eye,
  FileCheck
} from 'lucide-react'
import { scanDocument, confirmDocument, getTempPdfUrl, getTempPageImageUrl } from '../api'

const DOCUMENT_TYPES = [
  'Quyết định',
  'Công văn',
  'Tờ trình',
  'Thông báo',
  'Báo cáo',
  'Kế hoạch',
  'Chỉ thị',
  'Hợp đồng',
  'Quy chế',
  'Khác'
]

const URGENCY_LEVELS = ['Bình thường', 'Khẩn', 'Thượng khẩn', 'Hỏa tốc']

export default function ScanIngestion({ provider, onScanSuccess }) {
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStep, setProcessStep] = useState(0) // 1: render, 2: AI analysis, 3: Obsidian note
  const [scanResult, setScanResult] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [activeReviewTab, setActiveReviewTab] = useState('form') // 'form' | 'markdown'
  const [previewMode, setPreviewMode] = useState('pdf') // 'pdf' | 'thumb'
  const [newActionItem, setNewActionItem] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectFile(e.dataTransfer.files[0])
    }
  }

  const handleSelectFile = (selectedFile) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Hệ thống chỉ chấp nhận file scan định dạng .PDF')
      return
    }
    setError('')
    setFile(selectedFile)
    setScanResult(null)
    setMetadata(null)
  }

  const handleStartScan = async () => {
    if (!file) return
    setIsProcessing(true)
    setError('')
    setProcessStep(1)

    const stepTimer1 = setTimeout(() => setProcessStep(2), 700)
    const stepTimer2 = setTimeout(() => setProcessStep(3), 2000)

    try {
      const data = await scanDocument(file, provider)
      setScanResult(data)
      setMetadata(data.metadata)
      setProcessStep(4)
    } catch (err) {
      setError(err.message || 'Lỗi xử lý file scan bằng AI.')
      setProcessStep(0)
    } finally {
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      setIsProcessing(false)
    }
  }

  const handleFieldChange = (field, value) => {
    setMetadata(prev => ({ ...prev, [field]: value }))
  }

  const handleAddActionItem = () => {
    if (!newActionItem.trim()) return
    setMetadata(prev => ({
      ...prev,
      action_items: [...(prev.action_items || []), newActionItem.trim()]
    }))
    setNewActionItem('')
  }

  const handleRemoveActionItem = (index) => {
    setMetadata(prev => ({
      ...prev,
      action_items: prev.action_items.filter((_, idx) => idx !== index)
    }))
  }

  const handleConfirmAndSave = async () => {
    if (!scanResult || !metadata) return
    setIsSaving(true)
    setError('')

    try {
      await confirmDocument({
        temp_token: scanResult.temp_token,
        metadata: metadata,
        status: 'verified'
      })
      setSuccessMsg('Đã lưu văn bản vào Sổ thành công & Khởi tạo Second Brain Note trong Obsidian!')
      setTimeout(() => {
        if (onScanSuccess) onScanSuccess()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu trữ văn bản.')
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setScanResult(null)
    setMetadata(null)
    setError('')
    setSuccessMsg('')
    setProcessStep(0)
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Header Banner - Office Styling */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Trí tuệ nhân tạo OCR & Thể thức văn bản
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Nạp & Bóc Tách Văn Bản Scan (.PDF)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Tự động nhận diện tiêu đề, ngày tháng, đơn vị gửi, người ký tên, tóm tắt điều hành và khởi tạo ghi chú tri thức Obsidian Second Brain.
          </p>
        </div>

        {scanResult && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Nạp văn bản khác
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Upload Zone khi chưa có kết quả scan */}
      {!scanResult && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full py-8 space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
                : file
                ? 'border-blue-400 bg-blue-50/20 dark:bg-slate-900'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-white dark:bg-slate-900 shadow-xs'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
              accept=".pdf"
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 shadow-xs">
              <Upload className="w-8 h-8" />
            </div>

            {file ? (
              <div className="space-y-1">
                <span className="text-[11px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Đã sẵn sàng tải lên</span>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                  {file.name}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Tệp Scan .PDF
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Kéo thả file scan .PDF vào đây hoặc bấm để chọn tệp
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Hỗ trợ công văn, quyết định, tờ trình, thông báo, hợp đồng scan (tất cả các kích thước trang).
                </p>
              </div>
            )}
          </div>

          {file && !isProcessing && (
            <button
              onClick={handleStartScan}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tiến Hành Phân Tích Thể Thức Bằng AI</span>
            </button>
          )}

          {isProcessing && (
            <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  Tiến trình phân tích AI thông minh:
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono">
                  Động cơ: {provider === 'gemini' ? 'Gemini 2.5 Flash' : 'GPT-4o-mini'}
                </span>
              </div>

              {/* Progress Steps */}
              <div className="space-y-2.5">
                <div className={`flex items-center gap-3 text-xs p-2.5 rounded-lg border ${
                  processStep >= 1 ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300' : 'border-transparent text-slate-400'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    processStep > 1 ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {processStep > 1 ? '✓' : '1'}
                  </span>
                  <span>Kết xuất trang văn bản độ nét cao bằng PyMuPDF</span>
                </div>

                <div className={`flex items-center gap-3 text-xs p-2.5 rounded-lg border ${
                  processStep >= 2 ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300' : 'border-transparent text-slate-400'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    processStep > 2 ? 'bg-emerald-600 text-white' : processStep === 2 ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {processStep > 2 ? '✓' : '2'}
                  </span>
                  <span>AI Vision nhận diện thể thức: Số hiệu, Ngày tháng, Người ký, Cơ quan, Trích yếu</span>
                </div>

                <div className={`flex items-center gap-3 text-xs p-2.5 rounded-lg border ${
                  processStep >= 3 ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300' : 'border-transparent text-slate-400'
                }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    processStep >= 3 ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500'
                  }`}>
                    3
                  </span>
                  <span>Khởi tạo cấu trúc Second Brain: Wikilinks [[...]], Tags và Checklist công việc</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Màn hình Soát xét Chia đôi (Split View) */}
      {scanResult && metadata && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Cột trái: Đọc trực tiếp file scan PDF (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xs h-[78vh]">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate max-w-[220px]">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                {scanResult.original_filename}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{scanResult.num_pages} trang</span>
                {scanResult.thumbnail_base64 && (
                  <button
                    onClick={() => setPreviewMode(m => m === 'pdf' ? 'thumb' : 'pdf')}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    {previewMode === 'pdf' ? 'Xem ảnh trang 1' : 'Xem PDF inline'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex flex-col">
              {previewMode === 'pdf' ? (
                <iframe
                  src={`${getTempPdfUrl(scanResult.temp_token)}#toolbar=1&navpanes=0`}
                  title="Xem trước scan PDF"
                  className="w-full flex-1 border-none bg-white"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={scanResult.thumbnail_base64}
                    alt="Thumbnail trang đầu"
                    className="max-h-[70vh] object-contain shadow-md rounded border border-slate-300 bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Cột phải: Form đối soát metadata & Note Obsidian (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xs h-[78vh]">
            {/* Header Tabs */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveReviewTab('form')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeReviewTab === 'form'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Biểu Mẫu Soát Xét (Metadata)</span>
                </button>

                <button
                  onClick={() => setActiveReviewTab('markdown')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeReviewTab === 'markdown'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Obsidian Note (Second Brain)</span>
                </button>
              </div>

              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-md">
                AI điền sẵn
              </span>
            </div>

            {/* Tab 1: Form Editing */}
            {activeReviewTab === 'form' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* Row 1: Document Type & Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Loại văn bản:</label>
                    <select
                      value={metadata.document_type}
                      onChange={(e) => handleFieldChange('document_type', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {DOCUMENT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Số & Ký hiệu văn bản:</label>
                    <input
                      type="text"
                      value={metadata.doc_number || ''}
                      placeholder="VD: 142/QĐ-UBND"
                      onChange={(e) => handleFieldChange('doc_number', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-blue-700 dark:text-blue-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Row 2: Title */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Trích yếu nội dung (Tiêu đề):</label>
                  <textarea
                    rows={2}
                    value={metadata.title || ''}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                {/* Row 3: Issuing Org & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Cơ quan / Đơn vị ban hành:</label>
                    <input
                      type="text"
                      value={metadata.sender_org || ''}
                      onChange={(e) => handleFieldChange('sender_org', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Ngày ban hành (YYYY-MM-DD):</label>
                    <input
                      type="date"
                      value={metadata.issue_date || ''}
                      onChange={(e) => handleFieldChange('issue_date', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Row 4: Signer & Title & Urgency */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Người ký:</label>
                    <input
                      type="text"
                      value={metadata.signer_name || ''}
                      onChange={(e) => handleFieldChange('signer_name', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Chức vụ người ký:</label>
                    <input
                      type="text"
                      value={metadata.signer_title || ''}
                      onChange={(e) => handleFieldChange('signer_title', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Độ khẩn:</label>
                    <select
                      value={metadata.urgency || 'Bình thường'}
                      onChange={(e) => handleFieldChange('urgency', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {URGENCY_LEVELS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Executive Summary */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Tóm tắt điều hành:</label>
                  <textarea
                    rows={3}
                    value={metadata.summary || ''}
                    onChange={(e) => handleFieldChange('summary', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                {/* Action Items Checklist */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1 flex items-center justify-between">
                    <span>Nhiệm vụ & Chỉ đạo thực hiện (Checklist):</span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Tự động gắn vào Tasklist của Second Brain</span>
                  </label>
                  <div className="space-y-1.5 mb-2">
                    {metadata.action_items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl">
                        <span className="w-3.5 h-3.5 rounded border border-slate-400 dark:border-slate-600 flex-shrink-0" />
                        <span className="flex-1 text-xs text-slate-800 dark:text-slate-200">{item}</span>
                        <button
                          onClick={() => handleRemoveActionItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Thêm nhiệm vụ cụ thể cho phòng ban..."
                      value={newActionItem}
                      onChange={(e) => setNewActionItem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddActionItem())}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddActionItem}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm
                    </button>
                  </div>
                </div>

                {/* Second Brain Entities & Tags */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Thực thể liên kết Wikilinks trong Obsidian Second Brain:
                  </label>
                  <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {metadata.sender_org && (
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold">
                        [[{metadata.sender_org}]]
                      </span>
                    )}
                    {metadata.signer_name && (
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold">
                        [[{metadata.signer_name}]]
                      </span>
                    )}
                    {metadata.related_entities?.map((ent, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold">
                        [[{ent}]]
                      </span>
                    ))}
                    {metadata.tags?.map((t, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono text-[11px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Markdown Preview */}
            {activeReviewTab === 'markdown' && (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                {scanResult.markdown_preview}
              </div>
            )}

            {/* Confirm Actions Footer */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Lưu vào CSDL và tự động tạo note Markdown trong Obsidian Vault.
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmAndSave}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang lưu trữ & Tạo Second Brain...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác nhận & Lưu vào Sổ + Second Brain</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

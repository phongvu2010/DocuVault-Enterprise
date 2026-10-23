import React, { useState, useEffect } from 'react'
import {
  Search,
  FileText,
  Calendar,
  Building,
  User,
  AlertCircle,
  ExternalLink,
  Trash2,
  Eye,
  FileCode,
  CheckCircle2,
  ListTodo,
  Layers,
  Sparkles,
  Download,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Image as ImageIcon
} from 'lucide-react'
import {
  fetchDocuments,
  deleteDocument,
  getPdfUrl,
  getPageImageUrl,
  fetchDocumentPageCount
} from '../api'

const DOCUMENT_TYPES = [
  'Tất cả',
  'Quyết định',
  'Công văn',
  'Tờ trình',
  'Thông báo',
  'Báo cáo',
  'Kế hoạch',
  'Chỉ thị',
  'Hợp đồng',
]

export default function DocumentRegistry({ stats, refreshStats, onNavigateScan }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [detailTab, setDetailTab] = useState('info') // 'info' | 'pdf' | 'markdown'
  const [copiedMd, setCopiedMd] = useState(false)
  const [error, setError] = useState('')

  // Trạng thái cho Trình đọc tài liệu (PDF / HD Image Reader)
  const [readerMode, setReaderMode] = useState('pdf') // 'pdf' | 'pages'
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [rotation, setRotation] = useState(0)

  const loadDocs = async () => {
    try {
      setLoading(true)
      const data = await fetchDocuments({ q: searchQuery, docType: selectedType })
      setDocuments(data.documents || [])
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách văn bản')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocs()
  }, [selectedType])

  const handleOpenDoc = async (doc, initialTab = 'info') => {
    setSelectedDoc(doc)
    setDetailTab(initialTab)
    setCurrentPage(1)
    setZoomLevel(100)
    setRotation(0)

    try {
      const pageData = await fetchDocumentPageCount(doc.id)
      setTotalPages(pageData.total_pages || 1)
    } catch (e) {
      setTotalPages(1)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadDocs()
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Bạn có chắc chắn muốn xóa văn bản này khỏi Sổ lưu trữ?')) return
    try {
      await deleteDocument(id)
      setDocuments(prev => prev.filter(d => d.id !== id))
      if (selectedDoc?.id === id) setSelectedDoc(null)
      if (refreshStats) refreshStats()
    } catch (err) {
      alert(err.message)
    }
  }

  const copyMarkdown = (content) => {
    navigator.clipboard.writeText(content)
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 2000)
  }

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'Hỏa tốc':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            Hỏa tốc
          </span>
        )
      case 'Khẩn':
      case 'Thượng khẩn':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            Khẩn
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Thường
          </span>
        )
    }
  }

  const getDocTypeBadge = (type) => {
    return (
      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60">
        {type || 'Văn bản'}
      </span>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Thẻ Thống kê Tổng quan (Office Dashboard Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats?.total_documents ?? documents.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Văn bản đã đăng ký</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ListTodo className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats?.total_action_items ?? 0}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nhiệm vụ / Action Items</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {stats?.total_vault_notes ?? 0}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ghi chú Obsidian Vault</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">100%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đồng bộ Second Brain</div>
          </div>
        </div>
      </div>

      {/* Thanh Tìm kiếm & Bộ lọc (Search & Filters) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo số hiệu, trích yếu, người ký, cơ quan ban hành, nội dung..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Tìm kiếm
          </button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'Tất cả' ? 'Tất cả loại văn bản' : t}
              </option>
            ))}
          </select>

          <button
            onClick={onNavigateScan}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nạp văn bản scan</span>
          </button>
        </div>
      </div>

      {/* Bảng Sổ Văn Bản (Registry Data Table) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-950/50">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Sổ Đăng Ký Văn Bản Hành Chính
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Hiển thị <strong>{documents.length}</strong> văn bản
          </span>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-slate-500 dark:text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mr-3"></div>
            Đang tải dữ liệu văn bản...
          </div>
        ) : documents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Chưa có văn bản nào trong Sổ</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
              Tải lên tệp scan `.pdf` của cơ quan/doanh nghiệp. Hệ thống sẽ tự nhận diện thể thức và tạo ghi chú tri thức Obsidian.
            </p>
            <button
              onClick={onNavigateScan}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Nạp văn bản scan đầu tiên
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100/80 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-bold">Số & Ký hiệu</th>
                  <th className="px-5 py-3.5 font-bold">Loại</th>
                  <th className="px-5 py-3.5 font-bold w-1/3">Trích yếu nội dung</th>
                  <th className="px-5 py-3.5 font-bold">Cơ quan ban hành</th>
                  <th className="px-5 py-3.5 font-bold">Người ký</th>
                  <th className="px-5 py-3.5 font-bold">Ngày ban hành</th>
                  <th className="px-5 py-3.5 font-bold">Nhiệm vụ</th>
                  <th className="px-5 py-3.5 font-bold text-right">Đọc / Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => handleOpenDoc(doc, 'info')}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-4 whitespace-nowrap font-bold text-blue-700 dark:text-blue-400 font-mono text-xs">
                      {doc.doc_number || 'Chưa rõ số'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getDocTypeBadge(doc.document_type)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                        {doc.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getUrgencyBadge(doc.urgency)}
                        {doc.tags?.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[160px]">{doc.sender_org || 'Chưa rõ'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{doc.signer_name || 'Chưa rõ'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {doc.issue_date || 'N/A'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {doc.action_items?.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <ListTodo className="w-3 h-3" />
                          {doc.action_items.length} việc
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDoc(doc, 'pdf')}
                          title="Đọc trực tiếp file scan PDF"
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDoc(doc, 'markdown')}
                          title="Xem Note Obsidian"
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <FileCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, doc.id)}
                          title="Xóa văn bản"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Đọc Trực Tiếp Văn Bản (In-App Document Reader & Viewer) */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                {getDocTypeBadge(selectedDoc.document_type)}
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-md sm:max-w-xl">
                  {selectedDoc.doc_number ? `Số ${selectedDoc.doc_number}: ` : ''}{selectedDoc.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Modal Subtabs */}
                <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-1 rounded-xl border border-slate-300/80 dark:border-slate-800">
                  <button
                    onClick={() => setDetailTab('info')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      detailTab === 'info'
                        ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Thông tin chi tiết
                  </button>
                  <button
                    onClick={() => setDetailTab('pdf')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      detailTab === 'pdf'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Đọc file scan (.PDF)
                  </button>
                  <button
                    onClick={() => setDetailTab('markdown')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      detailTab === 'markdown'
                        ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Obsidian Note (.md)
                  </button>
                </div>

                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg ml-2 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 flex flex-col">
              {/* Tab 1: Metadata Form */}
              {detailTab === 'info' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Grid Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Trích yếu nội dung:</span>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 leading-relaxed">{selectedDoc.title}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-xs text-slate-500">Số & Ký hiệu:</span>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">{selectedDoc.doc_number || 'Chưa có'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Ngày ban hành:</span>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.issue_date || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Cơ quan ban hành:</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{selectedDoc.sender_org || 'Chưa rõ'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-xs text-slate-500">Người ký tên:</span>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.signer_name || 'Chưa rõ'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Chức vụ:</span>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedDoc.signer_title || 'Chưa rõ'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Callout */}
                  <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-xl p-5">
                    <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Tóm tắt điều hành (Executive Summary)
                    </h4>
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                      {selectedDoc.summary || 'Chưa có tóm tắt.'}
                    </p>
                  </div>

                  {/* Action Items */}
                  {selectedDoc.action_items?.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
                      <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ListTodo className="w-4 h-4" />
                        Nhiệm vụ & Chỉ đạo thực hiện ({selectedDoc.action_items.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedDoc.action_items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                            <span className="inline-block w-4 h-4 rounded border border-slate-400 dark:border-slate-600 mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Second Brain Links */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Mạng lưới liên kết Second Brain (Obsidian Wikilinks)
                    </h4>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedDoc.related_entities?.map((ent, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-md text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
                          [[{ent}]]
                        </span>
                      ))}
                      {selectedDoc.tags?.map((t, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      Tệp Note tương ứng trong Vault: <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{selectedDoc.markdown_filename}</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: IN-APP PDF SCAN VIEWER (KHÔNG BẮT TẢI VỀ MÁY) */}
              {detailTab === 'pdf' && (
                <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-slate-950">
                  {/* Toolbar Trình Đọc */}
                  <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      {/* Reader Mode Toggle */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        <button
                          onClick={() => setReaderMode('pdf')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            readerMode === 'pdf'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          Trình đọc PDF chuẩn
                        </button>
                        <button
                          onClick={() => setReaderMode('pages')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            readerMode === 'pages'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          Xem trang scan HD ({totalPages} trang)
                        </button>
                      </div>

                      {readerMode === 'pages' && (
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                            title="Trang trước"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Trang {currentPage} / {totalPages}
                          </span>
                          <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                            title="Trang sau"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1" />

                          <button
                            onClick={() => setZoomLevel(z => Math.max(60, z - 20))}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                            title="Thu nhỏ"
                          >
                            <ZoomOut className="w-4 h-4" />
                          </button>
                          <span className="font-mono text-slate-600 dark:text-slate-400">{zoomLevel}%</span>
                          <button
                            onClick={() => setZoomLevel(z => Math.min(200, z + 20))}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                            title="Phóng to"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRotation(r => (r + 90) % 360)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer ml-1"
                            title="Xoay trang"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">
                        {selectedDoc.pdf_filename}
                      </span>
                      {/* Nút chỉ tải khi người dùng chủ động bấm */}
                      <a
                        href={getPdfUrl(selectedDoc.id, true)}
                        download={selectedDoc.pdf_filename}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải file gốc</span>
                      </a>
                    </div>
                  </div>

                  {/* Khung Hiển Thị Nội Dung Trực Tuyến */}
                  <div className="flex-1 relative overflow-auto p-2 flex items-center justify-center">
                    {readerMode === 'pdf' ? (
                      /* Chế độ 1: Trình đọc PDF inline (Starlette inline content disposition) */
                      <iframe
                        src={`${getPdfUrl(selectedDoc.id, false)}#toolbar=1&navpanes=0`}
                        title="PDF Inline Viewer"
                        className="w-full h-full border-none rounded-lg bg-white shadow-sm"
                      />
                    ) : (
                      /* Chế độ 2: Trình đọc trang scan HD bằng PyMuPDF rendering */
                      <div className="h-full w-full flex items-center justify-center overflow-auto p-4">
                        <img
                          src={getPageImageUrl(selectedDoc.id, currentPage)}
                          alt={`Trang ${currentPage}`}
                          style={{
                            transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                            transition: 'transform 0.15s ease-out',
                          }}
                          className="max-h-[82vh] object-contain shadow-lg rounded border border-slate-300 dark:border-slate-800 bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Obsidian Markdown Note */}
              {detailTab === 'markdown' && (
                <div className="h-full flex flex-col p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Ghi chú được lưu trữ thực tế tại: <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">{selectedDoc.markdown_filename}</span>
                    </div>
                    <button
                      onClick={() => copyMarkdown(selectedDoc.markdown_content || '')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-xs cursor-pointer hover:bg-slate-50"
                    >
                      {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedMd ? 'Đã sao chép!' : 'Sao chép Markdown'}</span>
                    </button>
                  </div>
                  <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 overflow-y-auto font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-text shadow-xs">
                    {selectedDoc.markdown_content || 'Đang nạp ghi chú Obsidian...'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// DocuVault Enterprise API Client
const getApiBaseUrl = () => {
  const rawApiUrl = import.meta.env.VITE_API_URL
  if (rawApiUrl && rawApiUrl !== '__VITE_API_URL__') {
    return rawApiUrl
  }
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

export const API_BASE = getApiBaseUrl()

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error('Không thể kết nối Backend')
  return res.json()
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`)
  if (!res.ok) throw new Error('Lỗi lấy thống kê')
  return res.json()
}

export async function fetchDocuments({ q = '', docType = '', limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  if (docType && docType !== 'Tất cả') params.append('doc_type', docType)
  params.append('limit', limit)
  params.append('offset', offset)

  const res = await fetch(`${API_BASE}/api/documents?${params.toString()}`)
  if (!res.ok) throw new Error('Lỗi tải danh sách văn bản')
  return res.json()
}

export async function fetchDocumentDetail(id) {
  const res = await fetch(`${API_BASE}/api/documents/${id}`)
  if (!res.ok) throw new Error('Lỗi tải chi tiết văn bản')
  return res.json()
}

export async function deleteDocument(id) {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Lỗi khi xóa văn bản')
  return res.json()
}

export async function scanDocument(file, provider = 'gemini') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('provider', provider)

  const res = await fetch(`${API_BASE}/api/documents/scan`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Lỗi phân tích file scan bằng AI')
  }
  return res.json()
}

export async function confirmDocument({ temp_token, metadata, status = 'verified' }) {
  const res = await fetch(`${API_BASE}/api/documents/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temp_token, metadata, status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Lỗi lưu trữ văn bản vào CSDL và Obsidian')
  }
  return res.json()
}

export async function sendChatMessage(message, provider = 'gemini') {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, provider }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Lỗi kết nối AI Assistant')
  }
  return res.json()
}

export const getPdfUrl = (docId, download = false) =>
  `${API_BASE}/api/documents/${docId}/pdf${download ? '?download=true' : ''}`

export const getPageImageUrl = (docId, pageNum) =>
  `${API_BASE}/api/documents/${docId}/pages/${pageNum}`

export async function fetchDocumentPageCount(docId) {
  const res = await fetch(`${API_BASE}/api/documents/${docId}/page-count`)
  if (!res.ok) return { total_pages: 1 }
  return res.json()
}

export const getTempPdfUrl = (token) => `${API_BASE}/api/temp-pdf/${token}`
export const getTempPageImageUrl = (token, pageNum) => `${API_BASE}/api/temp-pdf/${token}/pages/${pageNum}`

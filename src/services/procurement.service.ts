import api from './api'

export const procurementService = {
  listPurchaseOrders: (params?: Record<string, unknown>) =>
    api.get('/procurement/purchase-orders', { params }),
  getPurchaseOrder: (id: string) => api.get(`/procurement/purchase-orders/${id}`),
  createPurchaseOrder: (data: unknown) => api.post('/procurement/purchase-orders', data),
  updatePurchaseOrder: (id: string, data: unknown) =>
    api.patch(`/procurement/purchase-orders/${id}`, data),
  approvePurchaseOrder: (id: string) => api.post(`/procurement/purchase-orders/${id}/approve`, {}),
  cancelPurchaseOrder: (id: string, data?: unknown) =>
    api.post(`/procurement/purchase-orders/${id}/cancel`, data ?? {}),

  listGoodsReceiptNotes: (params?: Record<string, unknown>) =>
    api.get('/procurement/goods-receipt-notes', { params }),
  getGoodsReceiptNote: (id: string) => api.get(`/procurement/goods-receipt-notes/${id}`),
  createGoodsReceiptNote: (data: unknown) => api.post('/procurement/goods-receipt-notes', data),
  updateGoodsReceiptNote: (id: string, data: unknown) =>
    api.patch(`/procurement/goods-receipt-notes/${id}`, data),
  postGoodsReceiptNote: (id: string) => api.post(`/procurement/goods-receipt-notes/${id}/post`, {}),
  getGrnReturnableQuantities: (grnId: string) =>
    api.get(`/procurement/goods-receipt-notes/${grnId}/returnable-quantities`),
  reverseGoodsReceiptNote: (id: string, data?: unknown) =>
    api.post(`/procurement/goods-receipt-notes/${id}/reverse`, data ?? {}),

  listPurchaseReturns: (params?: Record<string, unknown>) =>
    api.get('/procurement/purchase-returns', { params }),
  createPurchaseReturn: (data: unknown) => api.post('/procurement/purchase-returns', data),
  updatePurchaseReturn: (id: string, data: unknown) =>
    api.patch(`/procurement/purchase-returns/${id}`, data),
  postPurchaseReturn: (id: string, data?: unknown) =>
    api.post(`/procurement/purchase-returns/${id}/post`, data ?? {}),

  listSupplierInvoices: (params?: Record<string, unknown>) =>
    api.get('/procurement/supplier-invoices', { params }),
  getSupplierInvoice: (id: string) => api.get(`/procurement/supplier-invoices/${id}`),
  createSupplierInvoice: (data: unknown) => api.post('/procurement/supplier-invoices', data),
  updateSupplierInvoice: (id: string, data: unknown) => api.patch(`/procurement/supplier-invoices/${id}`, data),
  postSupplierInvoice: (id: string) => api.post(`/procurement/supplier-invoices/${id}/post`, {})
}

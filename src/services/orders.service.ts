import api from './api'

export const ordersService = {
  list: (params?: any) => api.get('/orders', { params }),
  create: (data: any) => api.post('/orders', data),
  getById: (id: string) => api.get(`/orders/${id}`),
  update: (id: string, data: any) => api.put(`/orders/${id}`, data),
  deliver: (id: string, data: any) => api.post(`/orders/${id}/deliver`, data),
  returnOrder: (id: string, data: any) => api.post(`/orders/${id}/return`, data),
  previewAmendment: (id: string, data: any) => api.post(`/orders/${id}/amendments/preview`, data),
  createAmendment: (id: string, data: any) => api.post(`/orders/${id}/amendments`, data),
  listAmendments: (id: string) => api.get(`/orders/${id}/amendments`),
  openAmendmentCreditNote: (orderId: string, amendmentId: string) =>
    api.get(`/orders/${orderId}/amendments/${amendmentId}/credit-note`, { responseType: 'blob' }),
  openCreditNote: (orderId: string, creditNoteId: string) =>
    api.get(`/orders/${orderId}/credit-notes/${creditNoteId}/pdf`, { responseType: 'blob' }),
  cancel: (id: string) => api.delete(`/orders/${id}`),
  /** Order Receipt (Sales Order) PDF — available as soon as the order exists. */
  openReceipt: (id: string) => api.get(`/orders/${id}/receipt`, { responseType: 'blob' }),
  openDeliveryInvoice: (orderId: string, deliveryId: string) =>
    api.get(`/orders/${orderId}/deliveries/${deliveryId}/invoice`, { responseType: 'blob' })
}

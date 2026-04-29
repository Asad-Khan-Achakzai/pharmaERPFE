import api from './api'

/** Unified home snapshot (backend composes existing services). Requires ENABLE_NEW_DASHBOARD on server. */
export const dashboardService = {
  home: (config?: { params?: { from?: string; to?: string }; signal?: AbortSignal }) =>
    api.get('/dashboard/home', config)
}

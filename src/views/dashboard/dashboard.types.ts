export type TodayEmployee = {
  employeeId: string
  name: string
  status: string
  checkInTime: string | null
  checkOutTime?: string | null
  hasCheckedOut?: boolean
  /** Resolved work shift / policy label from attendance policies (when enabled). */
  shiftId?: string | null
  shiftName?: string | null
  scheduleLabel?: string | null
}

export type TodayBoard = {
  employees: TodayEmployee[]
  summary: {
    present: number
    notMarked: number
    totalEmployees: number
    presentPayroll?: number
    pendingLateApproval?: number
    missingCheckoutToday?: number
    lateToday?: number
  }
  distribution: Record<string, number>
}

export type KpiItem = { title: string; value: string; icon: string; color: string }

export type LiveAttendanceStatus = 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT' | 'LATE_CHECKIN_PENDING'

export type LiveLocationSource = 'heartbeat' | 'checkin' | null

export interface LiveRepLocation {
  userId: string
  name: string
  attendanceStatus: LiveAttendanceStatus
  checkInTime: string | null
  checkOutTime: string | null
  lat: number | null
  lng: number | null
  accuracy?: number | null
  capturedAt: string | null
  ageSeconds: number | null
  locationSource?: LiveLocationSource
}

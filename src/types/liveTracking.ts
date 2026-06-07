export interface LiveRepLocation {
  userId: string
  name: string
  lat: number | null
  lng: number | null
  accuracy?: number | null
  capturedAt: string | null
  ageSeconds: number | null
}

/** Active company users from GET /users/assignable include `role`. */
export function filterMedicalReps<T extends { role?: string }>(users: T[] = []): T[] {
  return users.filter(u => u.role === 'MEDICAL_REP')
}

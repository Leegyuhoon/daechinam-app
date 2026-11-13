// 근무 레코드 하나의 경과 시간(시간 단위)을 계산합니다.
// 퇴근 기록이 없으면(진행중) 현재 시각까지의 경과시간을 반환합니다.
export function hoursOf(record) {
  const start = new Date(record.clockIn).getTime()
  const end = record.clockOut ? new Date(record.clockOut).getTime() : Date.now()
  if (Number.isNaN(start)) return 0
  return Math.max(0, (end - start) / 3600000)
}

/**
 * Generates a fly swatter cursor SVG data URL, themed for light or dark mode.
 */
export function getFlySwatCursor(isDark: boolean): string {
  const stroke = isDark ? '%2300ffcc' : '%2300A38C'
  const fill = isDark ? 'rgba(0,255,204,0.15)' : 'rgba(0,163,140,0.15)'
  const gripFill = isDark ? '%2300ffcc' : '%2300A38C'

  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='36'%3E%3Cg transform='rotate(-15 14 10)'%3E%3Crect x='4' y='1' width='16' height='16' rx='2' fill='${fill}' stroke='${stroke}' stroke-width='1.5'/%3E%3Cline x1='9.3' y1='1' x2='9.3' y2='17' stroke='${stroke}' stroke-width='.7' opacity='.4'/%3E%3Cline x1='14.7' y1='1' x2='14.7' y2='17' stroke='${stroke}' stroke-width='.7' opacity='.4'/%3E%3Cline x1='4' y1='6' x2='20' y2='6' stroke='${stroke}' stroke-width='.7' opacity='.4'/%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='${stroke}' stroke-width='.7' opacity='.4'/%3E%3Cpath d='M12 17 Q9 23 14 32' stroke='${stroke}' stroke-width='2.5' stroke-linecap='round' fill='none'/%3E%3Ccircle cx='14' cy='32' r='2' fill='${gripFill}' opacity='.6'/%3E%3C/g%3E%3C/svg%3E") 10 9, auto`
}

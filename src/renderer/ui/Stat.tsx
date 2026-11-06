export interface StatProps {
  label: string
  value: string
  tone?: 'ink' | 'accent'
}

export function Stat({ label, value, tone = 'ink' }: StatProps) {
  return (
    <div className="ui-stat" data-tone={tone} data-stat={label}>
      <span className="ui-stat-label">{label}</span>
      <strong className="ui-stat-value tnum">{value}</strong>
    </div>
  )
}

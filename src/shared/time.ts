const pad = (n: number) => String(n).padStart(2, '0')

export const mmss = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds))
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`
}

export const clock = (remaining: number) =>
  remaining < 0 ? `+${mmss(-remaining)}` : mmss(remaining)

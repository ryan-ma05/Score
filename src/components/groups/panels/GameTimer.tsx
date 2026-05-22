import { useCallback, useEffect, useRef, useState } from 'react'

type TimerState = 'idle' | 'running' | 'paused' | 'expired'

const PRESETS = [
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
]

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  } catch {
    // AudioContext unavailable in some environments — silently skip
  }
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function GameTimer() {
  const [duration, setDuration] = useState(60)
  const [customInput, setCustomInput] = useState('')
  const [remaining, setRemaining] = useState(60)
  const [state, setState] = useState<TimerState>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return clearTick
  }, [clearTick])

  function applyPreset(seconds: number) {
    clearTick()
    setDuration(seconds)
    setRemaining(seconds)
    setState('idle')
    setCustomInput('')
  }

  function applyCustom() {
    const val = Number(customInput)
    if (!Number.isFinite(val) || val < 1) return
    applyPreset(Math.round(val))
  }

  function start() {
    if (state === 'expired') {
      setRemaining(duration)
    }
    setState('running')
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTick()
          setState('expired')
          beep()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function pause() {
    clearTick()
    setState('paused')
  }

  function reset() {
    clearTick()
    setRemaining(duration)
    setState('idle')
  }

  const isLow = remaining <= 10 && state === 'running'
  const progress = duration > 0 ? remaining / duration : 1
  const circumference = 2 * Math.PI * 44 // r=44

  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50/85 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Game timer</p>

      {/* Preset buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            onClick={() => applyPreset(preset.seconds)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              duration === preset.seconds && customInput === ''
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="1"
            placeholder="Custom (s)"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
            className="w-24 rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Set
          </button>
        </div>
      </div>

      {/* Countdown display */}
      <div className="mt-4 flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <svg width="100" height="100" className="-rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={isLow ? '#ef4444' : state === 'expired' ? '#94a3b8' : '#f59e0b'}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`text-xl font-semibold tabular-nums ${
                isLow ? 'text-red-600' : state === 'expired' ? 'text-slate-400' : 'text-slate-900'
              }`}
            >
              {formatCountdown(remaining)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {state === 'expired' && (
            <p className="text-sm font-semibold text-red-600">Time&apos;s up!</p>
          )}
          <div className="flex flex-wrap gap-2">
            {state !== 'running' && (
              <button
                type="button"
                onClick={start}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                {state === 'paused' ? 'Resume' : state === 'expired' ? 'Restart' : 'Start'}
              </button>
            )}
            {state === 'running' && (
              <button
                type="button"
                onClick={pause}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Pause
              </button>
            )}
            {state !== 'idle' && (
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

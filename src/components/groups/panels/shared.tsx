import type { ReactNode } from 'react'
import type { GroupSessionStatus } from '../../../context/GroupContext'

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/90 bg-white/90 p-5 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/85 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

export function StatusPill({ status }: { status: GroupSessionStatus }) {
  const tone = {
    scheduled: 'bg-emerald-50 text-emerald-700',
    completed: 'bg-sky-50 text-sky-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }[status]

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {status}
    </span>
  )
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-semibold text-slate-950">{value}</span>
      </div>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  )
}

import { Button } from '@/components/ui/button'
import { Skeleton } from './skeleton-block'
import type { CronStatusPayload, CronTask } from './cronStatus'
import { CronStatusPanelSkeleton } from './CronStatusSkeleton'

function cn(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

function formatCheckTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function StatusPill({ label, variant }: { label: string; variant: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const styles = {
    ok: 'bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/20',
    warn: 'bg-amber-500/15 text-amber-900 ring-amber-500/25 dark:text-amber-200 dark:ring-amber-400/20',
    bad: 'bg-red-500/15 text-red-800 ring-red-500/25 dark:text-red-200 dark:ring-red-400/20',
    muted: 'bg-black/5 text-gray-700 ring-black/10 dark:bg-white/10 dark:text-dark-text-secondary dark:ring-white/10',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        styles[variant],
      )}
    >
      {label}
    </span>
  )
}

function taskStatusVariant(status: string, lastResult: string): 'ok' | 'warn' | 'bad' | 'muted' {
  if (/fail|error|stopped/i.test(status) || /fail|error/i.test(lastResult)) return 'bad'
  if (/active|running/i.test(status) && /ok|success/i.test(lastResult)) return 'ok'
  if (/active|running/i.test(status)) return 'muted'
  return 'warn'
}

function resultVariant(result: string): 'ok' | 'warn' | 'bad' | 'muted' {
  const r = result.toLowerCase()
  if (!r) return 'muted'
  if (/ok|success|pass/.test(r)) return 'ok'
  if (/fail|error/.test(r)) return 'bad'
  return 'warn'
}

function TaskCard({ task }: { task: CronTask }) {
  const sv = taskStatusVariant(task.status, task.last_result)
  const rv = resultVariant(task.last_result)
  const displayId = task.task_id.length > 56 ? `${task.task_id.slice(0, 28)}…${task.task_id.slice(-16)}` : task.task_id

  return (
    <article
      className={cn(
        'flex w-full min-w-0 shrink-0 flex-col gap-4 rounded-xl border border-black/10 bg-white/80 p-4 shadow-xs backdrop-blur-sm',
        'sm:flex-row sm:items-start sm:gap-6',
        'dark:border-dark-border-primary dark:bg-dark-bg-tertiary/80',
        'transition-shadow hover:shadow-md dark:hover:border-dark-border-secondary',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{task.task_name || '未命名任务'}</h3>
          <StatusPill label={task.status || 'unknown'} variant={sv} />
        </div>
        <p
          className="mt-1 truncate font-mono text-[11px] text-gray-500 dark:text-dark-text-tertiary"
          title={task.task_id || undefined}
        >
          {displayId || '—'}
        </p>
      </div>

      <dl
        className={cn(
          'grid w-full shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4',
          /* 固定元数据区宽度，避免每张卡随内容变宽导致列与左侧标题区不对齐 */
          'sm:w-96 sm:flex-none sm:shrink-0',
        )}
      >
        <div className="min-w-0">
          <dt className="text-gray-500 dark:text-dark-text-tertiary">上次运行</dt>
          <dd className="mt-0.5 break-words font-medium text-gray-900 dark:text-dark-text-primary">
            {task.last_run || '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500 dark:text-dark-text-tertiary">下次运行</dt>
          <dd className="mt-0.5 break-words font-medium text-gray-900 dark:text-dark-text-primary">
            {task.next_run || '—'}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500 dark:text-dark-text-tertiary">结果</dt>
          <dd className="mt-0.5">
            <StatusPill label={task.last_result || '—'} variant={rv} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500 dark:text-dark-text-tertiary">模型</dt>
          <dd className="mt-0.5 break-words font-medium text-gray-900 dark:text-dark-text-primary">
            {task.model || '—'}
          </dd>
        </div>
      </dl>
    </article>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent: 'neutral' | 'emerald' | 'rose' | 'slate'
}) {
  const ring =
    accent === 'emerald'
      ? 'ring-emerald-500/20 dark:ring-emerald-400/15'
      : accent === 'rose'
        ? 'ring-rose-500/20 dark:ring-rose-400/15'
        : accent === 'slate'
          ? 'ring-slate-400/20 dark:ring-slate-500/20'
          : 'ring-black/5 dark:ring-white/10'
  return (
    <div
      className={cn(
        'rounded-xl border border-black/10 bg-gradient-to-br from-white to-gray-50/90 px-4 py-3 dark:border-dark-border-primary dark:from-dark-bg-tertiary dark:to-dark-bg-secondary',
        'ring-1 ring-inset',
        ring,
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-dark-text-tertiary">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-dark-text-primary">
        {value}
      </div>
    </div>
  )
}

type Props = {
  loading: boolean
  error: string | null
  fetchedAt: string | null
  rowId: number | null
  payload: CronStatusPayload | null
  hasRow: boolean
  onRefresh: () => void
}

export function CronStatusPanel({ loading, error, fetchedAt, rowId, payload, hasRow, onRefresh }: Props) {
  const healthy = payload?.summary?.healthy ?? (payload?.summary?.issues?.length ?? 0) === 0
  const issues = payload?.summary?.issues ?? []

  return (
    <section
      className={cn(
        'rounded-xl border border-black/10 bg-white/70 p-5 backdrop-blur-sm dark:border-dark-border-primary dark:bg-dark-bg-secondary',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Cron 任务状态</h2>
          {loading && !payload && !error ? (
            <div className="mt-2 space-y-2" aria-hidden>
              <Skeleton className="h-3 w-56 max-w-full" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-600 dark:text-dark-text-secondary">
              数据源：<code className="rounded bg-black/5 px-1 dark:bg-white/10">cron_task_status</code>
              {rowId != null ? (
                <>
                  {' '}
                  · 行 <span className="tabular-nums">#{rowId}</span>
                </>
              ) : null}
              {fetchedAt ? (
                <>
                  <br />
                  上次同步 {new Date(fetchedAt).toLocaleString()}
                </>
              ) : null}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={onRefresh}
          className="shrink-0 shadow-xs dark:border-dark-border-primary dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg-secondary"
        >
          {loading ? '拉取中…' : '手动刷新'}
        </Button>
      </div>

      {error ? (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && !payload && !error ? <CronStatusPanelSkeleton /> : null}

      {!loading && !payload && !error && !hasRow ? (
        <div className="mt-6 rounded-lg border border-dashed border-black/15 bg-white/50 py-12 text-center text-sm text-gray-600 dark:border-dark-border-primary dark:bg-dark-bg-tertiary/50 dark:text-dark-text-secondary">
          暂无数据行。OpenClaw 写入后此处将展示概览与任务卡片。
        </div>
      ) : null}

      {!loading && hasRow && !payload && !error ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          无法识别 <code className="font-mono text-xs">status</code> 的结构，请查看控制台中的原始 JSON。
        </div>
      ) : null}

      {payload ? (
        <div className="mt-6 w-full min-w-0 space-y-8">
          <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-stretch">
            <div
              className={cn(
                'flex flex-1 flex-col justify-center rounded-xl border px-4 py-4 lg:max-w-md',
                healthy
                  ? 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white dark:border-emerald-900/40 dark:from-emerald-950/35 dark:to-dark-bg-tertiary'
                  : 'border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white dark:border-rose-900/40 dark:from-rose-950/35 dark:to-dark-bg-tertiary',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    healthy ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.45)]',
                  )}
                />
                <span className="text-sm font-semibold">{healthy ? '总体健康' : '需要关注'}</span>
              </div>
              <p className="mt-2 text-xs text-gray-600 dark:text-dark-text-secondary">
                检测时间 {formatCheckTime(payload.check_time)}
              </p>
              {issues.length > 0 ? (
                <ul className="mt-3 list-inside list-disc text-xs text-rose-800 dark:text-rose-200">
                  {issues.map((issue, i) => (
                    <li key={i} className="break-words">
                      {typeof issue === 'string' ? issue : JSON.stringify(issue)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-gray-600 dark:text-dark-text-secondary">
                  {healthy ? '未发现 summary 中的 issues。' : 'summary 标记为不健康，但未提供 issues 列表。'}
                </p>
              )}
            </div>

            <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
              <StatTile label="总任务" value={payload.total_tasks} accent="slate" />
              <StatTile label="活跃" value={payload.active_tasks} accent="emerald" />
              <StatTile label="失败" value={payload.failed_tasks} accent="rose" />
            </div>
          </div>

          <div className="w-full min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-text-tertiary">
              任务列表
            </h3>
            {payload.tasks.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600 dark:text-dark-text-secondary">tasks 数组为空。</p>
            ) : (
              <div
                className={cn(
                  'mt-3 flex w-full min-w-0 max-h-[calc(5*10.5rem+4*0.75rem)] flex-col gap-3 overflow-y-auto overscroll-y-contain',
                )}
              >
                {payload.tasks.map((task, i) => (
                  <TaskCard key={task.task_id || `task-${i}`} task={task} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

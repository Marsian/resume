import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CronStatusPanel } from './CronStatusPanel'
import { parseCronStatus } from './cronStatus'
import { getSupabaseClient } from './supabase'

type CronRow = {
  id: number
  created_at: string
  status: unknown
}

export default function ClawView() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<CronRow | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  const payload = useMemo(() => {
    if (!row) return null
    return parseCronStatus(row.status)
  }, [row])

  const pullLatest = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      const msg = '无法初始化 Supabase 客户端（URL 或 Publishable Key 为空）'
      setError(msg)
      console.error('[OpenClaw]', msg)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: qErr } = await supabase
      .from('cron_task_status')
      .select('id, created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setLoading(false)
    setFetchedAt(new Date().toISOString())

    if (qErr) {
      setRow(null)
      setError(qErr.message)
      console.error('[OpenClaw] Supabase 查询失败:', qErr)
      return
    }

    if (!data) {
      setRow(null)
      console.log('[OpenClaw] cron_task_status: 暂无数据（0 行）')
      return
    }

    const parsedRow: CronRow = {
      id: Number(data.id),
      created_at: String(data.created_at),
      status: data.status as unknown,
    }
    setRow(parsedRow)

    const parsed = parseCronStatus(parsedRow.status)
    console.log('[OpenClaw] latest row meta:', {
      id: parsedRow.id,
      created_at: parsedRow.created_at,
    })
    console.log('[OpenClaw] raw status JSON:', parsedRow.status)
    console.log('[OpenClaw] parsed status (for UI):', parsed)
    if (parsed) {
      console.log('[OpenClaw] structure:', {
        check_time: parsed.check_time,
        total_tasks: parsed.total_tasks,
        active_tasks: parsed.active_tasks,
        failed_tasks: parsed.failed_tasks,
        taskCount: parsed.tasks.length,
        summary: parsed.summary,
        sampleTask: parsed.tasks[0] ?? null,
      })
    }
  }, [])

  useEffect(() => {
    void pullLatest()
  }, [pullLatest])

  return (
    <div className="min-h-screen bg-white text-black dark:bg-dark-bg-primary dark:text-dark-text-primary transition-colors">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-sm border-b border-black/5 dark:bg-dark-bg-secondary dark:border-dark-border-primary">
        <div className="mx-auto flex max-w-6xl items-center gap-3 pl-[88px] pr-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            className="bg-white/70 shadow-xs backdrop-blur-sm hover:bg-white dark:border-dark-border-primary dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg-secondary"
          >
            返回
          </Button>
          <div className="flex flex-col leading-tight">
            <div className="text-base font-semibold">Claw</div>
            <div className="text-xs text-gray-600 dark:text-dark-text-secondary">OpenClaw 状态</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl pl-[88px] pr-4 py-6">
        <CronStatusPanel
          loading={loading}
          error={error}
          fetchedAt={fetchedAt}
          rowId={row?.id ?? null}
          payload={payload}
          hasRow={row != null}
          onRefresh={() => void pullLatest()}
        />
      </main>
    </div>
  )
}

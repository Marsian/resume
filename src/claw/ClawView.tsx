import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CronExecutionPanel } from './CronExecutionPanel'
import { CronJobsPanel } from './CronJobsPanel'
import { parseCronJobsStatus } from './cronJobsStatus'
import { parseCronStatus } from './cronStatus'
import { getSupabaseClient } from './supabase'

type CronRow = {
  id: number
  created_at: string
  status: unknown
}

export default function ClawView() {
  const navigate = useNavigate()
  const [execLoading, setExecLoading] = useState(false)
  const [execError, setExecError] = useState<string | null>(null)
  const [execRow, setExecRow] = useState<CronRow | null>(null)
  const [execFetchedAt, setExecFetchedAt] = useState<string | null>(null)

  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [jobsRow, setJobsRow] = useState<CronRow | null>(null)
  const [jobsFetchedAt, setJobsFetchedAt] = useState<string | null>(null)

  const execPayload = useMemo(() => {
    if (!execRow) return null
    return parseCronStatus(execRow.status)
  }, [execRow])

  const jobsPayload = useMemo(() => {
    if (!jobsRow) return null
    return parseCronJobsStatus(jobsRow.status)
  }, [jobsRow])

  const pullExecution = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      const msg = '无法初始化 Supabase 客户端（URL 或 Publishable Key 为空）'
      setExecError(msg)
      return
    }

    setExecLoading(true)
    setExecError(null)
    const { data, error: qErr } = await supabase
      .from('cron_task_status')
      .select('id, created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setExecLoading(false)
    setExecFetchedAt(new Date().toISOString())

    if (qErr) {
      setExecRow(null)
      setExecError(qErr.message)
      return
    }

    if (!data) {
      setExecRow(null)
      return
    }

    setExecRow({
      id: Number(data.id),
      created_at: String(data.created_at),
      status: data.status as unknown,
    })
  }, [])

  const pullJobs = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      const msg = '无法初始化 Supabase 客户端（URL 或 Publishable Key 为空）'
      setJobsError(msg)
      return
    }

    setJobsLoading(true)
    setJobsError(null)
    const { data, error: qErr } = await supabase
      .from('cron_jobs')
      .select('id, created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setJobsLoading(false)
    setJobsFetchedAt(new Date().toISOString())

    if (qErr) {
      setJobsRow(null)
      setJobsError(qErr.message)
      return
    }

    if (!data) {
      setJobsRow(null)
      return
    }

    setJobsRow({
      id: Number(data.id),
      created_at: String(data.created_at),
      status: data.status as unknown,
    })
  }, [])

  useEffect(() => {
    void pullJobs()
    void pullExecution()
  }, [pullJobs, pullExecution])

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-sm border-b border-black/5 dark:bg-card dark:border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 pl-4 pr-4 py-3 sm:pl-[88px]">
          <div className="flex flex-col leading-tight">
            <div className="text-base font-semibold">Claw</div>
            <div className="text-xs text-muted-foreground">OpenClaw 状态</div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            className="bg-white/70 backdrop-blur-sm dark:bg-muted"
          >
            返回
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 pl-4 pr-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pl-[88px] sm:py-6">
        <CronJobsPanel
          loading={jobsLoading}
          error={jobsError}
          fetchedAt={jobsFetchedAt}
          rowId={jobsRow?.id ?? null}
          payload={jobsPayload}
          hasRow={jobsRow != null}
          onRefresh={() => void pullJobs()}
        />
        <CronExecutionPanel
          loading={execLoading}
          error={execError}
          fetchedAt={execFetchedAt}
          rowId={execRow?.id ?? null}
          payload={execPayload}
          hasRow={execRow != null}
          onRefresh={() => void pullExecution()}
        />
      </main>
    </div>
  )
}

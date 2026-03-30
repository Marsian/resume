import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import ResumePage from './ResumePage'

export default function ResumeView() {
  const navigate = useNavigate()
  const floatingButtonClass =
    'pointer-events-auto bg-white/70 backdrop-blur-sm opacity-60 hover:opacity-100 focus-visible:opacity-100 dark:bg-card'

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflowX
    const prevBody = body.style.overflowX
    html.style.overflowX = 'hidden'
    body.style.overflowX = 'hidden'
    return () => {
      html.style.overflowX = prevHtml
      body.style.overflowX = prevBody
    }
  }, [])

  return (
    <div className="app-shell min-h-screen w-full overflow-x-hidden bg-background text-foreground transition-colors">
      <main className="app-main flex w-full min-w-0 max-w-full flex-col items-center justify-start overflow-x-clip pl-4 pr-4 pb-6 sm:min-h-screen sm:justify-center sm:pl-[88px] sm:pb-10">
        {/* 与 .resume-sheet 同宽，保证按钮栏在简历区域内的布局一致 */}
        <div className="resume-page-column w-full max-w-[210mm] min-w-0">
          <div className="no-print mb-2 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={floatingButtonClass}
              onClick={() => window.print()}
            >
              打印/导出 PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={floatingButtonClass}
              onClick={() => navigate('/')}
            >
              返回
            </Button>
          </div>
          <ResumePage />
        </div>
      </main>
    </div>
  )
}


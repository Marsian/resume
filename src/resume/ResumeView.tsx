import { useNavigate } from 'react-router-dom'

import ResumePage from './ResumePage'

export default function ResumeView() {
  const navigate = useNavigate()

  return (
    <div className="app-shell min-h-screen bg-white text-black dark:bg-dark-bg-primary dark:text-dark-text-primary transition-colors">
      <div className="no-print pointer-events-none fixed left-4 top-4 z-50">
        <button
          type="button"
          className="pointer-events-auto rounded-md border border-gray-300 bg-white/70 px-3 py-1.5 text-sm text-gray-900 shadow-sm backdrop-blur transition-opacity hover:bg-white hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-black/20 opacity-60 dark:border-dark-border-primary dark:bg-dark-bg-secondary dark:text-dark-text-primary dark:hover:bg-dark-bg-tertiary dark:focus:ring-dark-border-primary"
          onClick={() => navigate('/')}
        >
          返回
        </button>
      </div>

      <div className="no-print pointer-events-none fixed right-4 top-4 z-50">
        <button
          type="button"
          className="pointer-events-auto rounded-md border border-gray-300 bg-white/70 px-3 py-1.5 text-sm text-gray-900 shadow-sm backdrop-blur transition-opacity hover:bg-white hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-black/20 opacity-60 dark:border-dark-border-primary dark:bg-dark-bg-secondary dark:text-dark-text-primary dark:hover:bg-dark-bg-tertiary dark:focus:ring-dark-border-primary"
          onClick={() => window.print()}
        >
          打印/导出 PDF
        </button>
      </div>

      <main className="app-main flex items-center justify-center pl-[88px] pr-4 pb-10 pt-2">
        <ResumePage />
      </main>
    </div>
  )
}


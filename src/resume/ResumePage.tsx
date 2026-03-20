import type { ReactNode } from 'react'
import type { ResumeBlock } from './resumeContent'
import { resumeContents } from './resumeContent'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="w-full">
      <div className="text-[16px] font-semibold text-black dark:text-dark-text-primary">{children}</div>
      <div className="mt-[1.6mm] w-full border-t border-black/60 dark:border-dark-text-secondary" />
    </div>
  )
}

export default function ResumePage() {
  const blocks = resumeContents

  return (
    <div className="resume-sheet bg-white px-[14mm] py-[14mm] text-[14px] leading-[1.35] text-black dark:bg-dark-bg-primary dark:text-dark-text-primary">
      {blocks.map((block, idx) => (
        <BlockView key={`${block.type}-${'title' in block ? block.title : ''}-${idx}`} block={block} />
      ))}
    </div>
  )
}

function BlockView({ block }: { block: ResumeBlock }) {
  switch (block.type) {
    case 'header': {
      const h = block.data
      return (
        <div className="text-center">
          <div className="text-[18pt] font-semibold leading-[1.05]">{h.name}</div>
          {h.contacts?.length ? (
            <div className="mt-[4mm] text-[14px]">
              {h.contacts.filter((x) => x.value).map((it, idx) => (
                <span key={`${it.label}-${it.value}`}>
                  {idx === 0 ? null : <span className="px-[3mm]"> </span>}
                  <span>
                    {it.label}：
                    {it.href ? (
                      <a
                        href={it.href}
                        className="underline decoration-black/70 dark:decoration-dark-text-secondary underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {it.display ?? it.value}
                      </a>
                    ) : (
                      <span>{it.value}</span>
                    )}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )
    }
    case 'experience': {
      return (
        <div className="mt-[8mm]">
          <SectionTitle>{block.title}</SectionTitle>
          <div className="mt-[3.5mm] space-y-[4.5mm]">
            {block.data.items.map((ex) => (
              <div key={`${ex.company}-${ex.role}-${ex.period}`}>
                <div className="flex items-baseline justify-between gap-[6mm]">
                  <div className="font-semibold">{ex.company}</div>
                  <div className="text-[14px]">{ex.period}</div>
                </div>
                <div className="mt-[0.8mm] text-[14px]">{ex.role}</div>
                <ul className="mt-[2mm] space-y-[1.2mm] pl-[4mm] text-[14px]">
                  {ex.bullets.map((b) => (
                    <li key={b} className="list-disc">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'education': {
      return (
        <div className="mt-[6mm]">
          <SectionTitle>{block.title}</SectionTitle>
          <div className="mt-[3.5mm] space-y-[4.5mm]">
            {block.data.items.map((e) => (
              <div key={`${e.school}-${e.period}`}>
                <div className="flex items-baseline justify-between gap-[6mm]">
                  <div className="font-semibold">{e.school}</div>
                  <div className="text-[14px]">{e.period}</div>
                </div>
                {e.degree ? <div className="mt-[0.8mm] text-[14px]">{e.degree}</div> : null}
                {e.bullets?.length ? (
                  <ul className="mt-[2mm] space-y-[1.2mm] pl-[4mm] text-[14px]">
                    {e.bullets.map((b) => (
                      <li key={b} className="list-disc">
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'skills': {
      const items = block.data.items
      return (
        <div className="mt-[6mm]">
          <SectionTitle>{block.title}</SectionTitle>
          <ul className="mt-[3mm] space-y-[1.4mm] pl-[4mm] text-[14px]">
            {items.map((s) => {
              const [k, ...rest] = s.split('：')
              const v = rest.join('：').trim()
              const hasKv = rest.length > 0 && v.length > 0
              return (
                <li key={s} className="list-disc leading-[1.35]">
                  {hasKv ? (
                    <>
                      <span className="font-semibold">{k}：</span>
                      <span>{v}</span>
                    </>
                  ) : (
                    <span>{s}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )
    }
    case 'licenses': {
      const items = block.data.items
      return (
        <div className="mt-[6mm]">
          <SectionTitle>{block.title}</SectionTitle>
          <ul className="mt-[3mm] space-y-[1.4mm] pl-[4mm] text-[14px]">
            {items.map((s) => (
              <li key={s} className="list-disc leading-[1.35]">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )
    }
  }
}


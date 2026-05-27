import { Trash2 } from 'lucide-react'
import { TesterBadge } from './TesterBadge'
import type { Question } from '../domains/bugs/model'

interface QuestionsSectionProps {
  questions: Question[]
  onDelete: (q: Question) => void
}

export default function QuestionsSection({ questions, onDelete }: QuestionsSectionProps) {
  if (!questions.length) return null

  return (
    <div className="mt-5">
      <div className="mb-2 inline-block rounded-md bg-blue-50 dark:bg-blue-900/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">
        Open Questions ({questions.length})
      </div>
      {questions.map((q) => (
        <div
          key={q.id}
          className="mb-2 flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-900 p-3"
          style={{ borderLeft: '4px solid #3b82f6' }}
        >
          <span className="text-xs font-bold text-blue-500 dark:text-blue-400" style={{ minWidth: 36 }}>
            {q.id}
          </span>
          <span className="flex-1 text-sm text-slate-900 dark:text-gray-200">{q.text}</span>
          <TesterBadge>{q.tester}</TesterBadge>
          <button
            onClick={() => onDelete(q)}
            className="shrink-0 text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
            title="Delete question"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/// <reference lib="dom" />
import { test, expect, describe, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import QuestionsSection from '../QuestionsSection'
import type { Question } from '../../types'

afterEach(() => cleanup())

const questions: Question[] = [
  { id: 'Q01', text: 'Does the basket persist?', tester: 'Alice' },
  { id: 'Q02', text: 'Is the URL correct?', tester: 'Bob' },
]

describe('QuestionsSection', () => {
  test('returns null when questions array is empty', () => {
    const { container } = render(<QuestionsSection questions={[]} onDelete={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  test('renders header with question count', () => {
    render(<QuestionsSection questions={questions} onDelete={() => {}} />)
    expect(screen.getByText('Open Questions (2)')).toBeInTheDocument()
  })

  test('renders each question id, text, and tester', () => {
    render(<QuestionsSection questions={questions} onDelete={() => {}} />)
    expect(screen.getByText('Q01')).toBeInTheDocument()
    expect(screen.getByText('Does the basket persist?')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Q02')).toBeInTheDocument()
    expect(screen.getByText('Is the URL correct?')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  test('calls onDelete with the question when delete button is clicked', () => {
    const onDelete = mock(() => {})
    render(<QuestionsSection questions={questions} onDelete={onDelete} />)
    const deleteButtons = screen.getAllByTitle('Delete question')
    fireEvent.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete.mock.calls[0][0]).toEqual(questions[0])
  })
})

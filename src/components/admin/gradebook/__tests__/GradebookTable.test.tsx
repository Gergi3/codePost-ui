// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { GradebookResponse } from '../../../../api-client';
import { DEFAULT_PAGE_SIZE } from '../../../utils/LocalSettings';
import { createLocalStorageMock, installLocalStorageMock, restoreLocalStorage } from '../../../../test-utils';
import { GradebookTable } from '../Gradebook';

/** 60 students, one assignment column — enough rows to spill onto a second page. */
const makeData = (): GradebookResponse =>
  ({
    assignments: [{ id: 1, name: 'HW1', points: 100 }],
    quizzes: [],
    rows: Array.from({ length: 60 }, (_, i) => {
      const n = String(i).padStart(2, '0');
      return {
        student: `student${n}@x.edu`,
        section: i % 2 === 0 ? 'P01' : 'P02',
        assignmentCells: [{ assignment: 1, grade: i, personalBest: i, hasSubmission: true, isFinalized: true }],
        quizCells: [],
        totalEarned: i,
        totalPossible: 100,
        percent: i,
      };
    }),
  }) as unknown as GradebookResponse;

const bodyRows = (container: HTMLElement) =>
  [...container.querySelectorAll('.ant-table-tbody > tr.ant-table-row')];

describe('GradebookTable', () => {
  // The page size is a persisted global preference, so these need a storage mock that
  // actually retains what it is given — the default stub in setupTests does not.
  const { mock } = createLocalStorageMock();

  beforeEach(() => {
    installLocalStorageMock(mock);
    mock.clear();
  });

  afterEach(() => restoreLocalStorage());

  it('paginates at the default page size and defaults to ranking by total (desc)', () => {
    const { container } = render(<GradebookTable data={makeData()} />);
    expect(bodyRows(container)).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(screen.getByText('60 students')).toBeTruthy();

    // Default sort is Total descending, so the highest scorer (student59, grade 59) leads
    // and holds rank 1.
    const first = bodyRows(container)[0];
    expect(first.textContent).toContain('student59@x.edu');
    expect(first.querySelector('td')!.textContent).toBe('1'); // Rank column

    // Page 2 continues down the ranking: student49 … student40.
    fireEvent.click(screen.getByTitle('2'));
    const rows = bodyRows(container);
    expect(rows).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(rows[0].textContent).toContain('student49@x.edu');
  });

  it('the size changer actually resizes the page', () => {
    const { container } = render(<GradebookTable data={makeData()} />);
    expect(bodyRows(container)).toHaveLength(DEFAULT_PAGE_SIZE);

    fireEvent.mouseDown(container.querySelector('.ant-pagination-options-size-changer .ant-select-content')!);
    fireEvent.click(screen.getByTitle('25 / page'));

    expect(bodyRows(container)).toHaveLength(25);
  });

  it('search filters rows by student email', () => {
    vi.useFakeTimers();
    const { container } = render(<GradebookTable data={makeData()} />);
    fireEvent.change(screen.getByPlaceholderText('Search students…'), {
      target: { value: 'student59' },
    });
    // The search is debounced 250ms so typing doesn't re-filter per keystroke.
    act(() => vi.advanceTimersByTime(300));
    vi.useRealTimers();
    const rows = bodyRows(container);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('student59@x.edu');
  });

  it('shows the grade (not a Pending tag) for unfinalized submissions, and — when ungraded', () => {
    const data = {
      assignments: [{ id: 1, name: 'HW1', points: 100 }],
      quizzes: [],
      rows: [
        {
          student: 'graded@x.edu',
          section: null,
          // Unfinalized but graded: the admin leaderboard must still show the number.
          assignmentCells: [{ assignment: 1, grade: 72, personalBest: 72, hasSubmission: true, isFinalized: false }],
          quizCells: [],
          totalEarned: 72,
          totalPossible: 100,
          percent: 72,
        },
        {
          student: 'nograde@x.edu',
          section: null,
          // Submission present but no grade yet → em-dash, never "Pending".
          assignmentCells: [{ assignment: 1, grade: null, personalBest: null, hasSubmission: true, isFinalized: false }],
          quizCells: [],
          totalEarned: 0,
          totalPossible: 0,
          percent: null,
        },
      ],
    } as unknown as GradebookResponse;

    const { container } = render(<GradebookTable data={data} />);
    expect(container.textContent).not.toContain('Pending');
    const graded = bodyRows(container).find((r) => r.textContent?.includes('graded@x.edu'))!;
    expect(graded.textContent).toContain('72');
  });

  it('shares a rank on tied totals (competition ranking)', () => {
    const data = {
      assignments: [{ id: 1, name: 'HW1', points: 100 }],
      quizzes: [],
      rows: [
        { student: 'a@x.edu', section: null, assignmentCells: [{ assignment: 1, grade: 90, personalBest: 90, hasSubmission: true, isFinalized: true }], quizCells: [], totalEarned: 90, totalPossible: 100, percent: 90 },
        { student: 'b@x.edu', section: null, assignmentCells: [{ assignment: 1, grade: 90, personalBest: 90, hasSubmission: true, isFinalized: true }], quizCells: [], totalEarned: 90, totalPossible: 100, percent: 90 },
        { student: 'c@x.edu', section: null, assignmentCells: [{ assignment: 1, grade: 50, personalBest: 50, hasSubmission: true, isFinalized: true }], quizCells: [], totalEarned: 50, totalPossible: 100, percent: 50 },
      ],
    } as unknown as GradebookResponse;

    const { container } = render(<GradebookTable data={data} />);
    const rankOf = (email: string) =>
      bodyRows(container).find((r) => r.textContent?.includes(email))!.querySelector('td')!.textContent;
    expect(rankOf('a@x.edu')).toBe('1');
    expect(rankOf('b@x.edu')).toBe('1'); // tie shares rank 1
    expect(rankOf('c@x.edu')).toBe('3'); // next rank skips 2
  });
});

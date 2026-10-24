// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { describe, expect, it } from 'vitest';
import { GradebookResponse } from '../../../../api-client';
import {
  assignmentAverage,
  buildRows,
  classAveragePercent,
  computeRanks,
  percentColor,
  quizAveragePercent,
  sectionOptions,
} from '../gradebookMath';

const data = {
  assignments: [{ id: 1, name: 'HW1', points: 100 }],
  quizzes: [{ id: 7, title: 'Week 1' }],
  rows: [
    {
      student: 'a@x.edu',
      section: 'P01',
      assignmentCells: [{ assignment: 1, grade: 90, personalBest: 90, hasSubmission: true, isFinalized: true }],
      quizCells: [{ quiz: 7, score: 8, maxScore: 10, needsGrading: false, hasAttempts: true }],
      totalEarned: 98,
      totalPossible: 110,
      percent: 89.09,
    },
    {
      // Pending everywhere: an unfinalized submission and an ungraded quiz attempt.
      student: 'b@x.edu',
      section: null,
      assignmentCells: [{ assignment: 1, grade: null, personalBest: null, hasSubmission: true, isFinalized: false }],
      quizCells: [{ quiz: 7, score: null, maxScore: null, needsGrading: true, hasAttempts: true }],
      totalEarned: 0,
      totalPossible: 0,
      percent: null,
    },
    {
      // Graded quiz with a different personal maxScore (random draw / generated section).
      student: 'c@x.edu',
      section: 'P02',
      assignmentCells: [{ assignment: 1, grade: 70, personalBest: 70, hasSubmission: true, isFinalized: true }],
      quizCells: [{ quiz: 7, score: 6, maxScore: 12, needsGrading: false, hasAttempts: true }],
      totalEarned: 76,
      totalPossible: 112,
      percent: 67.86,
    },
  ],
} as unknown as GradebookResponse;

describe('buildRows', () => {
  it('keys the parallel cell arrays by column id', () => {
    const rows = buildRows(data);
    expect(rows[0].byAssignment[1].grade).toBe(90);
    expect(rows[0].byQuiz[7].score).toBe(8);
    expect(rows[1].section).toBeNull();
  });
});

describe('averages', () => {
  const rows = buildRows(data);

  it('assignmentAverage means personal-best cells only', () => {
    // (90 + 70) / 2 — the pending row has no personal best, excluded.
    expect(assignmentAverage(rows, 1)).toBe(80);
  });

  it("quizAveragePercent normalizes by each student's own maxScore", () => {
    // (8/10 + 6/12) / 2 = 65%
    expect(quizAveragePercent(rows, 7)).toBeCloseTo(65);
  });

  it('classAveragePercent uses personal-best percent, skips rows with nothing graded', () => {
    // personalBestPossible = 100 (one assignment, 100pts)
    // a: 90/100=90%, c: 70/100=70%, b: null → excluded
    expect(classAveragePercent(rows)).toBeCloseTo(80);
  });

  it('returns null when nothing is graded', () => {
    const empty = buildRows({ ...data, rows: [data.rows[1]] } as GradebookResponse);
    expect(assignmentAverage(empty, 1)).toBeNull();
    expect(quizAveragePercent(empty, 7)).toBeNull();
    expect(classAveragePercent(empty)).toBeNull();
  });
});

describe('sectionOptions', () => {
  it('lists unique sections sorted, ignoring unsectioned rows', () => {
    expect(sectionOptions(buildRows(data))).toEqual(['P01', 'P02']);
  });
});

describe('percentColor', () => {
  it('bands green / amber / red', () => {
    expect(percentColor(85)).toBe('#52c41a');
    expect(percentColor(65)).toBe('#faad14');
    expect(percentColor(30)).toBe('#ff4d4f');
  });
});

describe('computeRanks', () => {
  const rows = buildRows(data);

  it('ranks by personal-best total descending; nothing-graded sorts last', () => {
    // personalBests: a=90, c=70, b=0 (null → 0 earned, but b has no personal best so sorts last)
    // personalBestPossible=100 for all (same assignment set)
    const ranks = computeRanks(rows, 'total');
    expect(ranks.get('a@x.edu')).toBe(1);
    expect(ranks.get('c@x.edu')).toBe(2);
    expect(ranks.get('b@x.edu')).toBe(3);
  });

  it('ranks by personal-best percent descending; null percent sorts last', () => {
    // personalBestPercent: a=90%, c=70%, b=null
    const ranks = computeRanks(rows, 'percent');
    expect(ranks.get('a@x.edu')).toBe(1);
    expect(ranks.get('c@x.edu')).toBe(2);
    expect(ranks.get('b@x.edu')).toBe(3);
  });

  it('shares a rank on ties and skips the next (competition ranking)', () => {
    const tied = [
      { student: 'x', section: null, byAssignment: {}, byQuiz: {}, totalEarned: 50, totalPossible: 50, percent: 100, completedAllMaxAt: null, personalBestEarned: 50, personalBestPercent: 100 },
      { student: 'y', section: null, byAssignment: {}, byQuiz: {}, totalEarned: 50, totalPossible: 50, percent: 100, completedAllMaxAt: null, personalBestEarned: 50, personalBestPercent: 100 },
      { student: 'z', section: null, byAssignment: {}, byQuiz: {}, totalEarned: 40, totalPossible: 50, percent: 80, completedAllMaxAt: null, personalBestEarned: 40, personalBestPercent: 80 },
    ];
    const ranks = computeRanks(tied, 'total');
    expect(ranks.get('x')).toBe(1);
    expect(ranks.get('y')).toBe(1); // tie shares rank 1 (both null tiebreak)
    expect(ranks.get('z')).toBe(3); // next rank skips 2
  });

  it('breaks ties by completedAllMaxAt ascending (earlier wins)', () => {
    const tied = [
      { student: 'late@x.edu', section: null, byAssignment: {}, byQuiz: {}, totalEarned: 90, totalPossible: 100, percent: 90, completedAllMaxAt: '2026-03-10T12:00:00Z', personalBestEarned: 90, personalBestPercent: 90 },
      { student: 'early@x.edu', section: null, byAssignment: {}, byQuiz: {}, totalEarned: 90, totalPossible: 100, percent: 90, completedAllMaxAt: '2026-03-05T08:00:00Z', personalBestEarned: 90, personalBestPercent: 90 },
      { student: 'none@x.edu', section: null, byAssignment: {}, byQuiz: {}, totalEarned: 90, totalPossible: 100, percent: 90, completedAllMaxAt: null, personalBestEarned: 90, personalBestPercent: 90 },
    ];
    const ranks = computeRanks(tied, 'total');
    expect(ranks.get('early@x.edu')).toBe(1);  // earliest completion
    expect(ranks.get('late@x.edu')).toBe(2);   // later completion
    expect(ranks.get('none@x.edu')).toBe(3);   // no timestamp ranks last
  });
});

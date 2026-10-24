// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { GradebookAssignmentCell, GradebookQuizCell, GradebookResponse } from '../../../api-client';

/** One table row: the server's parallel cell arrays re-keyed by column id for O(1) lookup. */
export interface IGradebookRow {
  student: string;
  section: string | null;
  byAssignment: Record<number, GradebookAssignmentCell>;
  byQuiz: Record<number, GradebookQuizCell>;
  totalEarned: number;
  totalPossible: number;
  percent: number | null;
  completedAllMaxAt: string | null;
  /** Sum of each assignment's personal-best grade (highest grade ever recorded per submission). */
  personalBestEarned: number;
  /** Sum of all assignment points in scope (denominator for personal-best percent). */
  personalBestPossible: number;
  /** personalBestEarned / personalBestPossible × 100, or null when nothing is graded. */
  personalBestPercent: number | null;
}

export const buildRows = (data: GradebookResponse): IGradebookRow[] => {
  const personalBestPossible = data.assignments.reduce((s, a) => s + Number(a.points), 0);
  return data.rows.map((r) => {
    const personalBestEarned = r.assignmentCells.reduce((sum, c) => {
      // personalBest is the highest snapshot grade ever; fall back to current grade when
      // no snapshots exist yet (e.g. before the snapshot system, or ungraded submissions).
      const best = c.personalBest != null ? Number(c.personalBest) : c.grade != null ? Number(c.grade) : null;
      return sum + (best ?? 0);
    }, 0);
    const hasAnyGrade = r.assignmentCells.some(
      (c) => c.personalBest != null || c.grade != null,
    );
    return {
      student: r.student,
      section: r.section ?? null,
      byAssignment: Object.fromEntries(r.assignmentCells.map((c) => [c.assignment, c])),
      byQuiz: Object.fromEntries(r.quizCells.map((c) => [c.quiz, c])),
      totalEarned: Number(r.totalEarned),
      totalPossible: Number(r.totalPossible),
      percent: r.percent != null ? Number(r.percent) : null,
      completedAllMaxAt: r.completedAllMaxAt ?? null,
      personalBestEarned,
      personalBestPossible,
      personalBestPercent:
        personalBestPossible > 0 && hasAnyGrade
          ? (personalBestEarned / personalBestPossible) * 100
          : null,
    };
  });
};

const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length;

/** Mean personal-best grade for an assignment column (falls back to current grade when no snapshots). */
export const assignmentAverage = (rows: IGradebookRow[], assignmentId: number): number | null =>
  mean(
    rows
      .map((r) => {
        const c = r.byAssignment[assignmentId];
        return c?.personalBest ?? c?.grade;
      })
      .filter((g): g is number => g != null)
      .map(Number),
  );

/** Mean score percentage for a quiz column, over graded rows only. Each student is
 *  normalized by their OWN maxScore (random draws / generated sections vary per student). */
export const quizAveragePercent = (rows: IGradebookRow[], quizId: number): number | null =>
  mean(
    rows
      .map((r) => r.byQuiz[quizId])
      .filter((c): c is GradebookQuizCell => c?.score != null && c.maxScore != null && Number(c.maxScore) > 0)
      .map((c) => (Number(c.score) / Number(c.maxScore)) * 100),
  );

/** Mean personal-best percent across rows that have any personal-best grade. */
export const classAveragePercent = (rows: IGradebookRow[]): number | null =>
  mean(rows.map((r) => r.personalBestPercent).filter((p): p is number => p != null));

/** The unique section names present, sorted (for the section filter). */
export const sectionOptions = (rows: IGradebookRow[]): string[] =>
  [...new Set(rows.map((r) => r.section).filter((s): s is string => s != null))].sort();

/** Progress-bar color band for an overall percent. */
export const percentColor = (percent: number): string => {
  if (percent >= 80) return '#52c41a';
  if (percent >= 60) return '#faad14';
  return '#ff4d4f';
};

/** Which metric the leaderboard ranks by. */
export type RankMetric = 'total' | 'percent';

/** Rank every row by the chosen metric (descending) using standard competition ranking:
 *  equal values share a rank, and the next rank skips accordingly (1, 2, 2, 4).
 *
 *  Primary metric: personal-best total (or percent) — the highest grade the student ever
 *  recorded, not their current grade. This means regressions after a good run don't hurt rank.
 *  Tie-break: the student who reached that personal best *first* ranks higher (earlier
 *  `completedAllMaxAt`); rows without it sort last.
 *
 *  Returns a map from student email to rank, so rank is derived from the metric itself —
 *  never from the table's transient display/sort order. */
export const computeRanks = (rows: IGradebookRow[], metric: RankMetric): Map<string, number> => {
  const valueOf = (r: IGradebookRow): number =>
    metric === 'total'
      ? r.personalBestEarned
      : r.personalBestPercent == null
        ? -Infinity
        : r.personalBestPercent;
  const tieBreakOf = (r: IGradebookRow): number =>
    r.completedAllMaxAt == null ? Infinity : new Date(r.completedAllMaxAt).getTime();
  const ordered = [...rows].sort((a, b) => {
    const diff = valueOf(b) - valueOf(a);
    if (diff !== 0) return diff;
    return tieBreakOf(a) - tieBreakOf(b); // earlier completion = better rank
  });
  const ranks = new Map<string, number>();
  let lastValue: number | null = null;
  let lastTieBreak: number | null = null;
  let lastRank = 0;
  ordered.forEach((row, i) => {
    const value = valueOf(row);
    const tb = tieBreakOf(row);
    if (lastValue === null || value !== lastValue || tb !== lastTieBreak) {
      lastRank = i + 1;
      lastValue = value;
      lastTieBreak = tb;
    }
    ranks.set(row.student, lastRank);
  });
  return ranks;
};

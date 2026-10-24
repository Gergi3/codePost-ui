// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '../../../api-client/clients';
import { GradebookResponse } from '../../../api-client';
import { courseKeys } from '../../../lib/queryKeys';

/** The course leaderboard: every active student × every assignment and quiz, with totals
 *  over graded work (course admins only — the server 403s everyone else). Pass
 *  `assignmentIds` to rank over a subset of assignments; the server recomputes totals. */
export const useGradebook = (courseId: number | undefined, assignmentIds?: number[]) =>
  useQuery({
    queryKey: courseKeys.gradebook(courseId ?? -1, assignmentIds),
    queryFn: (): Promise<GradebookResponse> =>
      coursesApi.gradebookRetrieve({
        id: courseId!,
        assignments: assignmentIds && assignmentIds.length > 0 ? assignmentIds.join(',') : undefined,
      }),
    enabled: !!courseId,
  });

export interface GradeSnapshot {
  grade: string | null;
  created: string;
  seed: boolean;
}

export interface StudentAssignmentHistory {
  assignmentId: number;
  assignmentName: string;
  assignmentPoints: string;
  submissionId: number | null;
  currentGrade: string | null;
  snapshots: GradeSnapshot[];
}

export const useStudentGradeHistory = (courseId: number | undefined, student: string | undefined) =>
  useQuery({
    queryKey: courseKeys.studentGradeHistory(courseId ?? -1, student ?? ''),
    queryFn: async (): Promise<StudentAssignmentHistory[]> => {
      const url = `${process.env.REACT_APP_API_URL}/courses/${courseId}/studentGradeHistory/?student=${encodeURIComponent(student!)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!courseId && !!student,
  });

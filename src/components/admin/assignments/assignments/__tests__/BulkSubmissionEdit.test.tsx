// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

import BulkSubmissionEdit from '../BulkSubmissionEdit';
import { Course } from '../../../../../api-client';
import { Assignment, SubmissionInfoType } from '../../../../../types/common';

const ME = 'prof@test.edu';

const sub = (overrides: Partial<SubmissionInfoType>): SubmissionInfoType =>
  ({ id: 0, assignment: 7, students: [], grader: null, isFinalized: false, ...overrides }) as SubmissionInfoType;

const submissions = [
  sub({ id: 1, grader: ME }), // claimed, unfinalized → released
  sub({ id: 2, grader: ME, isFinalized: true }), // finalized → untouched
  sub({ id: 3 }), // unclaimed → untouched
];

const renderDialog = () => {
  const bulkUpdateSubmissions = vi.fn().mockResolvedValue(undefined);
  render(
    <BulkSubmissionEdit
      activeAssignment={{ id: 7 } as Assignment}
      submissions={submissions}
      currentCourse={{ id: 3 } as Course}
      onCancel={vi.fn()}
      myEmail={ME}
      bulkUpdateSubmissions={bulkUpdateSubmissions}
    />,
  );
  return { bulkUpdateSubmissions };
};

describe('BulkSubmissionEdit release action', () => {
  it('counts only claimed, unfinalized submissions', () => {
    renderDialog();
    expect(
      screen.getByText(/Release claimed submissions back to the queue \(impacts 1 submission\)/),
    ).toBeInTheDocument();
  });

  it('clears the grader on claimed, unfinalized submissions only', async () => {
    const { bulkUpdateSubmissions } = renderDialog();

    fireEvent.click(screen.getByLabelText(/Release claimed submissions/));
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));

    await waitFor(() => expect(bulkUpdateSubmissions).toHaveBeenCalledTimes(1));
    const [assignmentId, getPayload] = bulkUpdateSubmissions.mock.calls[0];
    expect(assignmentId).toBe(7);
    expect(submissions.map(getPayload)).toEqual([{ id: 1, grader: null }, { id: 2 }, { id: 3 }]);
  });
});

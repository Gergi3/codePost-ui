// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

import type { AssignmentFileType } from '../../../../utils/file';

// Monaco doesn't run in jsdom; a textarea stands in so the Raw view is observable.
vi.mock('../../../../lib/monaco', () => ({
  default: ({ value }: { value: string }) => <textarea data-testid="raw-editor" readOnly value={value} />,
}));

import AssignmentFilesForm from './AssignmentFilesForm';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const makeFile = (overrides: Partial<AssignmentFileType>): AssignmentFileType =>
  ({
    id: 1,
    name: 'plot.png',
    extension: 'png',
    path: 'images',
    required: false,
    assignment: 1,
    data: PNG,
    created: '',
    modified: '',
    description: '',
    ...overrides,
  }) as AssignmentFileType;

const openViewer = (file: AssignmentFileType) => {
  render(<AssignmentFilesForm value={[file]} />);
  fireEvent.click(screen.getByRole('button', { name: /View/ }));
};

// Each viewer test mounts the full antd modal: 1-2s locally, over the default 5s cap on a
// loaded CI runner.
const slow = { timeout: 15000 };

describe('AssignmentFilesForm file viewer', () => {
  it('opens images in Preview mode as a rendered image, not the data URI', slow, () => {
    openViewer(makeFile({}));
    expect(screen.getByAltText('Preview of plot.png')).toHaveAttribute('src', PNG);
    expect(screen.queryByTestId('raw-editor')).not.toBeInTheDocument();
  });

  it('switches to the raw data URI with the Raw toggle', slow, () => {
    openViewer(makeFile({}));
    fireEvent.click(screen.getByText('Raw'));
    expect(screen.getByTestId('raw-editor')).toHaveValue(PNG);
  });

  it('previews SVG stored as raw markup', slow, () => {
    openViewer(makeFile({ name: 'icon.svg', extension: 'svg', data: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
    expect(screen.getByAltText('Preview of icon.svg').getAttribute('src')).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,/,
    );
  });

  it('keeps the code editor for source files', slow, () => {
    openViewer(makeFile({ name: 'main.py', extension: 'py', data: 'print(1)' }));
    expect(screen.getByTestId('raw-editor')).toHaveValue('print(1)');
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
  });
});

describe('AssignmentFilesForm uploads', () => {
  const upload = (file: File) => {
    const onChange = vi.fn();
    const { container } = render(<AssignmentFilesForm value={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    return onChange;
  };

  it('stores an uploaded image as a data URI instead of rejecting it', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], 'covariance.jpg', {
      type: 'image/jpeg',
    });
    const onChange = upload(jpeg);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [added] = onChange.mock.calls[0][0] as AssignmentFileType[];
    expect(added.name).toBe('covariance.jpg');
    expect(added.data).toMatch(/^data:image\/jpeg;base64,/);
    expect(screen.queryByText('Unsupported File Type')).not.toBeInTheDocument();
  });

  it('still stores source files as plain text', async () => {
    const onChange = upload(new File(['print(1)\n'], 'main.py', { type: 'text/x-python' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [added] = onChange.mock.calls[0][0] as AssignmentFileType[];
    expect(added.data).toBe('print(1)\n');
  });
});

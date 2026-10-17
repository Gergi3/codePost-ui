// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import * as React from 'react';
import debounce from 'lodash/debounce';
import queryString from 'query-string';
import { useLocation, useNavigate } from 'react-router';

import { ICodeConsoleState } from '../../../types/CodeConsole.types';
import { useCodeConsoleStore } from '../../../stores/useCodeConsoleStore';
import { FileWithId } from '../../../utils/file';
import type { ExecutionResult } from '../../../utils/fileExecution';

type CursorSnapshot = { startLine: number; endLine?: number; startChar?: number; endChar?: number };

interface UseExecutionHandlersOptions {
  setState: (updater: React.SetStateAction<ICodeConsoleState>) => void;
  lastCursorRef: React.MutableRefObject<CursorSnapshot | null>;
}

/**
 * Bundles code-execution and cursor-related callbacks.
 *
 * Extracted from CodeConsole to isolate execution-specific state management.
 */
export function useExecutionHandlers({ setState, lastCursorRef }: UseExecutionHandlersOptions) {
  const selectedFile = useCodeConsoleStore((s) => s.selectedFile) as FileWithId | undefined;
  const location = useLocation();
  const navigate = useNavigate();

  const handleExecutionComplete = React.useCallback(
    (result: ExecutionResult) => {
      const fileId = result.file_id || selectedFile?.id;
      if (fileId) {
        const normalizedResult = {
          success: result.success,
          stdout: result.stdout ?? undefined,
          stderr: result.stderr ?? undefined,
          output_data: result.output_data ?? undefined,
          error: result.error ?? undefined,
        };
        setState((prev) => ({
          ...prev,
          executionResults: {
            ...prev.executionResults,
            [fileId]: normalizedResult,
          },
        }));
      }
    },
    [selectedFile?.id, setState],
  );

  const handleClearOutputs = React.useCallback(() => {
    setState((prev) => {
      const selected = prev.selectedFile as FileWithId | undefined;
      if (!selected?.id) return prev;
      const newResults = { ...prev.executionResults };
      delete newResults[selected.id];
      return { ...prev, executionResults: newResults };
    });
  }, [setState]);

  const handleContentChange = React.useMemo(
    () =>
      debounce((content: string) => {
        const currentSelectedFile = useCodeConsoleStore.getState().selectedFile as FileWithId | undefined;
        if (currentSelectedFile) {
          useCodeConsoleStore.getState().setTemporaryFileContent(currentSelectedFile.id, content);
        }
      }, 500),
    [],
  );

  const handleCursorChange = React.useCallback(
    (cursor: CursorSnapshot | null) => {
      lastCursorRef.current = cursor;
    },
    [lastCursorRef],
  );

  const handleScrolledToComment = React.useCallback(() => {
    const currentQuery = queryString.parse(location.search);
    // Nothing to strip → do NOT navigate. A bare `navigate({search}, {replace})` here
    // resolves relative to this console route and would clobber an in-progress
    // navigation away from the submission (e.g. clicking Home → /student), yanking the
    // user back to /code/<id>. Only act when there's actually a `comment` param to remove.
    if (currentQuery.comment === undefined) return;
    delete currentQuery.comment;
    navigate({ search: queryString.stringify(currentQuery) }, { replace: true });
  }, [location.search, navigate]);

  return {
    handleExecutionComplete,
    handleClearOutputs,
    handleContentChange,
    handleCursorChange,
    handleScrolledToComment,
  };
}

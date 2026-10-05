// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { useEffect, useState, useCallback, useRef } from 'react';
import { Table, Input, InputNumber, Switch, Typography, message } from 'antd';
import { testCasesApi } from '../../../../../../api-client/clients';
import { loadIDList } from '../../../../../../utils/generics';
import { TestCaseType } from '../../../../../../types/models';

interface IProps {
  // The category whose tests to show. We take the testCases id list + a nonce
  // that changes whenever the parent re-syncs (e.g. after a file upload).
  testCaseIds: number[];
  reloadNonce?: number;
  onPointsChanged?: () => void;
}

/**
 * Editable table of the parsed tests in a category. Display name, points, and
 * hidden are instructor-owned (stored on TestCase) and PATCHed directly; the
 * method name is read-only. maxPoints on the category is recomputed server-side
 * whenever a test's points change.
 */
export const TestCaseTable = (props: IProps) => {
  const [rows, setRows] = useState<TestCaseType[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    if (!props.testCaseIds || props.testCaseIds.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const tests = await loadIDList<TestCaseType>(props.testCaseIds, {
        read: (id: number) => testCasesApi.retrieve({ id }) as unknown as Promise<TestCaseType>,
      });
      // Stable order: sortKey then id.
      tests.sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0) || a.id - b.id);
      setRows(tests);
    } catch {
      message.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  }, [props.testCaseIds]);

  useEffect(() => {
    load();
  }, [load, props.reloadNonce]);

  const patch = (id: number, patchedTestCase: Record<string, unknown>, isPoints = false) => {
    // Optimistic local update.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patchedTestCase } : r)));
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }
    debounceTimers.current[id] = setTimeout(async () => {
      try {
        await testCasesApi.partialUpdate({ id, patchedTestCase: patchedTestCase as never });
        if (isPoints) {
          props.onPointsChanged?.();
        }
      } catch {
        message.error('Failed to save test change');
        load(); // revert to server state
      }
    }, 500);
  };

  const columns = [
    {
      title: 'Display name',
      dataIndex: 'description',
      key: 'description',
      render: (_: unknown, row: TestCaseType) => (
        <Input
          defaultValue={row.description}
          onChange={(e) => patch(row.id, { description: e.target.value })}
          placeholder="Display name"
        />
      ),
    },
    {
      title: 'Method',
      dataIndex: 'functionName',
      key: 'functionName',
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: 'Points',
      dataIndex: 'pointsPass',
      key: 'pointsPass',
      width: 110,
      render: (_: unknown, row: TestCaseType) => (
        <InputNumber
          min={0}
          step={1}
          defaultValue={Number(row.pointsPass ?? 1)}
          onChange={(val) => patch(row.id, { pointsPass: Number(val ?? 0) }, true)}
        />
      ),
    },
    {
      title: 'Hidden',
      dataIndex: 'hidden',
      key: 'hidden',
      width: 90,
      render: (_: unknown, row: TestCaseType) => (
        <Switch
          defaultChecked={!!row.hidden}
          onChange={(checked) => patch(row.id, { hidden: checked })}
        />
      ),
    },
  ];

  const total = rows.reduce((sum, r) => sum + Number(r.pointsPass ?? 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text strong>Tests ({rows.length})</Typography.Text>
        <Typography.Text type="secondary">Total points: {total}</Typography.Text>
      </div>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: 'No tests yet — add test files below.' }}
      />
    </div>
  );
};

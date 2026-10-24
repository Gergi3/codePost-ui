// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import * as React from 'react';
import { Link, useLocation } from 'react-router';
import { Alert, Card, Checkbox, Empty, Flex, Input, Progress, Select, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import CPButton from '../../core/CPButton';
import { Course, GradebookAssignmentCell, GradebookQuizCell, GradebookResponse, ResponseError } from '../../../api-client';
import ExportModal from './ExportModal';
import {
  IGradebookRow,
  RankMetric,
  assignmentAverage,
  buildRows,
  classAveragePercent,
  computeRanks,
  percentColor,
  quizAveragePercent,
  sectionOptions,
} from './gradebookMath';
import { useGradebook } from './queries';
import { PAGE_SIZE_OPTIONS } from '../../utils/LocalSettings';
import useDefaultPageSize from '../../utils/useDefaultPageSize';

const { Text, Title } = Typography;

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text type="secondary">{children}</Text>
);

const formatFirstMaxAt = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const renderAssignmentCell = (cell?: GradebookAssignmentCell, showTimes?: boolean) => {
  // Show personal best (highest snapshot grade); fall back to current grade when no snapshots exist.
  const best = cell?.personalBest != null
    ? Number(cell.personalBest)
    : cell?.grade != null ? Number(cell.grade) : null;
  const hasLink = cell?.submissionId != null;
  const hasTime = showTimes && cell?.firstMaxAt != null;
  if (best == null && !hasTime) return <Muted>—</Muted>;
  return (
    <Flex vertical align="flex-end" gap={0}>
      {best != null && (
        hasLink ? (
          <a href={`/code/${cell!.submissionId}`} target="_blank" rel="noopener noreferrer">
            {best}
          </a>
        ) : (
          <span>{best}</span>
        )
      )}
      {hasTime && (
        <Muted>
          <span style={{ fontSize: 11 }}>{formatFirstMaxAt(cell!.firstMaxAt!)}</span>
        </Muted>
      )}
      {best == null && <Muted>—</Muted>}
    </Flex>
  );
};

const renderQuizCell = (cell?: GradebookQuizCell) => {
  if (cell?.score != null) return `${Number(cell.score)} / ${Number(cell.maxScore)}`;
  if (cell?.needsGrading) return <Tag color="orange">Pending</Tag>;
  return <Muted>—</Muted>;
};

const renderPercent = (percent: number | null) => {
  if (percent === null) return <Muted>—</Muted>;
  const p = Number(percent);
  return (
    <Flex align="center" gap={8}>
      {/* The bar is decorative — the text next to it is the accessible value. */}
      <span aria-hidden style={{ width: 56, display: 'inline-flex' }}>
        <Progress percent={p} size="small" showInfo={false} strokeColor={percentColor(p)} style={{ margin: 0 }} />
      </span>
      <Text>{p.toFixed(1)}%</Text>
    </Flex>
  );
};

// Sort helpers: ungraded rows always sort below graded ones.
const gradeOf = (row: IGradebookRow, assignmentId: number) => {
  const c = row.byAssignment[assignmentId];
  const g = c?.personalBest ?? c?.grade;
  return g == null ? -1 : Number(g);
};
const quizRatioOf = (row: IGradebookRow, quizId: number) => {
  const c = row.byQuiz[quizId];
  if (c?.score == null || !c.maxScore || Number(c.maxScore) <= 0) return -1;
  return Number(c.score) / Number(c.maxScore);
};

interface ITableProps {
  data: GradebookResponse;
  /** Full assignment set (id + name) for the picker — stays complete even when `data` is
   *  filtered to a subset. Omitted in tests that don't exercise filtering. */
  assignmentOptions?: { id: number; name: string }[];
  /** Currently selected assignment ids ([] = all). Controlled by the fetch wrapper. */
  selectedAssignmentIds?: number[];
  onSelectedAssignmentsChange?: (ids: number[]) => void;
  /** True while a filter refetch is in flight, to disable the picker momentarily. */
  isRefetching?: boolean;
}

/** The gradebook grid itself (presentational — takes the fetched response). Exported for
 *  tests; the default export wraps it with fetching, error handling, and the export button. */
export const GradebookTable: React.FC<ITableProps> = ({
  data,
  assignmentOptions,
  selectedAssignmentIds,
  onSelectedAssignmentsChange,
  isRefetching,
}) => {
  const [search, setSearch] = React.useState('');
  // Debounced: each keystroke re-filters all rows and recomputes the summary
  // averages. The input is uncontrolled, so typing itself stays instant.
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    if (value === '') {
      setSearch('');
      return;
    }
    searchDebounceRef.current = setTimeout(() => setSearch(value), 250);
  }, []);
  React.useEffect(
    () => () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    },
    [],
  );
  const [section, setSection] = React.useState<string | undefined>(undefined);
  const [rankMetric, setRankMetric] = React.useState<RankMetric>('total');
  const [showTimes, setShowTimes] = React.useState(false);
  const [pageSize, setPageSize] = useDefaultPageSize();
  const location = useLocation();
  // Derive the base admin URL from the current pathname (".../leaderboard" → ".../")
  const historyBase = location.pathname.replace(/\/leaderboard\/?$/, '/leaderboard/history');

  const rows = React.useMemo(() => buildRows(data), [data]);
  const sections = React.useMemo(() => sectionOptions(rows), [rows]);
  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(
      (r) => (!needle || r.student.toLowerCase().includes(needle)) && (!section || r.section === section),
    );
  }, [rows, search, section]);

  // Rank is derived from the chosen metric over the FILTERED cohort (so searching or filtering
  // to a section re-ranks within it, consistent with how the summary averages work). It is NOT
  // read from the table's display order, so clicking a column header to sort never changes ranks.
  const ranks = React.useMemo(() => computeRanks(filtered, rankMetric), [filtered, rankMetric]);

  const columns: ColumnsType<IGradebookRow> = React.useMemo(
    () => [
      {
        title: 'Rank',
        key: 'rank',
        fixed: 'left',
        width: 70,
        align: 'center',
        // No sorter: rank comes from the metric (via computeRanks), not the table's sort state.
        render: (_, row) => ranks.get(row.student) ?? <Muted>—</Muted>,
      },
      {
        title: 'Student',
        dataIndex: 'student',
        key: 'student',
        fixed: 'left',
        width: 230,
        sorter: (a, b) => a.student.localeCompare(b.student),
        render: (email: string) => (
          <Link to={`${historyBase}?student=${encodeURIComponent(email)}`}>{email}</Link>
        ),
      },
      {
        title: 'Section',
        key: 'section',
        width: 90,
        render: (_, row) => row.section ?? <Muted>—</Muted>,
        sorter: (a, b) => (a.section ?? '').localeCompare(b.section ?? ''),
      },
      ...(data.assignments.length > 0
        ? [
            {
              title: 'Assignments',
              children: data.assignments.map((a) => ({
                title: (
                  <>
                    {a.name} <Muted>/{Number(a.points)}</Muted>
                  </>
                ),
                key: `a-${a.id}`,
                width: 130,
                align: 'right' as const,
                sorter: (x: IGradebookRow, y: IGradebookRow) => gradeOf(x, a.id) - gradeOf(y, a.id),
                render: (_: unknown, row: IGradebookRow) => renderAssignmentCell(row.byAssignment[a.id], showTimes),
              })),
            },
          ]
        : []),
      ...(data.quizzes.length > 0
        ? [
            {
              title: 'Quizzes',
              children: data.quizzes.map((q) => ({
                title: q.title,
                key: `q-${q.id}`,
                width: 140,
                align: 'right' as const,
                sorter: (x: IGradebookRow, y: IGradebookRow) => quizRatioOf(x, q.id) - quizRatioOf(y, q.id),
                render: (_: unknown, row: IGradebookRow) => renderQuizCell(row.byQuiz[q.id]),
              })),
            },
          ]
        : []),
      {
        title: 'Overall',
        children: [
          {
            title: 'Best total',
            key: 'total',
            width: 130,
            align: 'right' as const,
            defaultSortOrder: 'descend' as const,
            sorter: (a: IGradebookRow, b: IGradebookRow) => a.personalBestEarned - b.personalBestEarned,
            render: (_: unknown, row: IGradebookRow) =>
              row.personalBestPercent == null
                ? <Muted>—</Muted>
                : `${row.personalBestEarned} / ${row.personalBestPossible}`,
          },
          {
            title: 'Best %',
            key: 'percent',
            width: 150,
            sorter: (a: IGradebookRow, b: IGradebookRow) =>
              (a.personalBestPercent ?? -1) - (b.personalBestPercent ?? -1),
            render: (_: unknown, row: IGradebookRow) => renderPercent(row.personalBestPercent),
          },
        ],
      },
    ],
    [data, ranks, showTimes],
  );

  // Class averages over the FILTERED rows, so filtering to a section shows that
  // section's averages. Computed from all filtered rows, not just the visible page.
  // Memoized: antd calls the summary function every render, and the averages walk
  // all filtered rows once per column — O(students × columns).
  const summaryNode = React.useMemo(() => {
    const classAvg = classAveragePercent(filtered);
    // Leading cells: Rank (0), Student (1), Section (2); averages start at 3.
    let index = 3;
    return (
      <Table.Summary fixed>
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} />
          <Table.Summary.Cell index={1}>
            <Text strong>Average{section ? ` (${section})` : ''}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={2} />
          {data.assignments.map((a) => {
            const avg = assignmentAverage(filtered, a.id);
            return (
              <Table.Summary.Cell key={`a-${a.id}`} index={index++} align="right">
                {avg === null ? <Muted>—</Muted> : <Text strong>{avg.toFixed(1)}</Text>}
              </Table.Summary.Cell>
            );
          })}
          {data.quizzes.map((q) => {
            const avg = quizAveragePercent(filtered, q.id);
            return (
              <Table.Summary.Cell key={`q-${q.id}`} index={index++} align="right">
                {avg === null ? <Muted>—</Muted> : <Text strong>{avg.toFixed(0)}%</Text>}
              </Table.Summary.Cell>
            );
          })}
          <Table.Summary.Cell index={index++} />
          <Table.Summary.Cell index={index++}>
            {classAvg === null ? <Muted>—</Muted> : <Text strong>{classAvg.toFixed(1)}%</Text>}
          </Table.Summary.Cell>
        </Table.Summary.Row>
      </Table.Summary>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, data.assignments, data.quizzes, section]);
  const summary = () => summaryNode;

  if (rows.length === 0) {
    return <Empty description="No students enrolled yet." image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />;
  }

  return (
    <>
      <Flex gap={12} wrap style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          placeholder="Search students…"
          aria-label="Search students"
          style={{ width: 260 }}
          onChange={handleSearchChange}
        />
        {sections.length > 0 && (
          <Select
            allowClear
            placeholder="All sections"
            aria-label="Filter by section"
            style={{ width: 160 }}
            value={section}
            onChange={setSection}
            options={sections.map((s) => ({ value: s, label: s }))}
          />
        )}
        {assignmentOptions && assignmentOptions.length > 0 && onSelectedAssignmentsChange && (
          <Select
            mode="multiple"
            allowClear
            placeholder="All assignments"
            aria-label="Rank over assignments"
            style={{ minWidth: 240, maxWidth: 420 }}
            value={selectedAssignmentIds}
            onChange={onSelectedAssignmentsChange}
            loading={isRefetching}
            maxTagCount="responsive"
            optionFilterProp="label"
            options={assignmentOptions.map((a) => ({ value: a.id, label: a.name }))}
          />
        )}
        <Select
          aria-label="Rank by"
          style={{ width: 150 }}
          value={rankMetric}
          onChange={setRankMetric}
          options={[
            { value: 'total', label: 'Rank by total' },
            { value: 'percent', label: 'Rank by percent' },
          ]}
        />
        <Checkbox
          checked={showTimes}
          onChange={(e) => setShowTimes(e.target.checked)}
        >
          Show submission times
        </Checkbox>
      </Flex>
      <Table<IGradebookRow>
        dataSource={filtered}
        columns={columns}
        rowKey="student"
        size="small"
        rowClassName={(row) => {
          // Medal tint for the podium (rank is the metric-derived rank, not display order).
          const rank = ranks.get(row.student);
          return rank === 1 ? 'lb-rank-gold' : rank === 2 ? 'lb-rank-silver' : rank === 3 ? 'lb-rank-bronze' : '';
        }}
        pagination={{
          pageSize,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onShowSizeChange: (_current, size) => setPageSize(size),
          onChange: (_page, size) => setPageSize(size),
          showTotal: (total) => `${total} student${total === 1 ? '' : 's'}`,
        }}
        scroll={{ x: 'max-content' }}
        summary={summary}
        locale={{ emptyText: <Empty description="No students match your filters." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </>
  );
};

interface IProps {
  course: Course;
}

/** Course leaderboard: every active student ranked by score across the selected assignments
 *  (and quizzes), with per-assignment points. Course admins only (the server 403s everyone
 *  else). Grades show regardless of finalization — this is the admin view. */
const Gradebook: React.FC<IProps> = ({ course }) => {
  // [] = all assignments. Drives the server-side filter (totals/percent/rank recompute).
  const [selectedAssignmentIds, setSelectedAssignmentIds] = React.useState<number[]>([]);
  const { data, isLoading, isError, error, refetch, isRefetching } = useGradebook(
    course.id,
    selectedAssignmentIds,
  );
  const [exportOpen, setExportOpen] = React.useState(false);

  // Picker options must list ALL assignments, but `data.assignments` shrinks to the selected
  // subset once a filter is applied. Snapshot the full set from the first unfiltered response.
  const [allAssignments, setAllAssignments] = React.useState<{ id: number; name: string }[]>([]);
  React.useEffect(() => {
    if (data && selectedAssignmentIds.length === 0) {
      setAllAssignments(data.assignments.map((a) => ({ id: a.id, name: a.name })));
    }
  }, [data, selectedAssignmentIds.length]);

  const forbidden = error instanceof ResponseError && error.response?.status === 403;

  const stats =
    data &&
    [
      `${data.rows.length} student${data.rows.length === 1 ? '' : 's'}`,
      `${data.assignments.length} assignment${data.assignments.length === 1 ? '' : 's'}`,
      `${data.quizzes.length} quiz${data.quizzes.length === 1 ? '' : 'zes'}`,
    ].join(' · ');

  return (
    <Card
      title={
        <Flex vertical gap={2}>
          <Title level={2} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Leaderboard
          </Title>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {stats ?? 'Students ranked by score across assignments and quizzes.'}
          </Text>
        </Flex>
      }
      extra={
        <Flex gap={8}>
          <Tooltip title="Reload the latest grades">
            <CPButton icon={<ReloadOutlined />} loading={isRefetching} onClick={() => refetch()} aria-label="Reload leaderboard" />
          </Tooltip>
          <Tooltip title="Choose columns and download a spreadsheet-ready CSV">
            <CPButton icon={<DownloadOutlined />} onClick={() => setExportOpen(true)} disabled={!data}>
              Export CSV
            </CPButton>
          </Tooltip>
        </Flex>
      }
    >
      {isLoading ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin size="large" />
        </Flex>
      ) : isError ? (
        forbidden ? (
          <Alert
            type="warning"
            showIcon
            message="Only course admins can view the leaderboard."
            description="Ask a course admin for access, or use your per-assignment and per-quiz grading views."
          />
        ) : (
          <Alert
            type="error"
            showIcon
            message="The leaderboard could not be loaded."
            action={
              <CPButton size="small" onClick={() => refetch()}>
                Try again
              </CPButton>
            }
          />
        )
      ) : data ? (
        <GradebookTable
          data={data}
          assignmentOptions={allAssignments}
          selectedAssignmentIds={selectedAssignmentIds}
          onSelectedAssignmentsChange={setSelectedAssignmentIds}
          isRefetching={isRefetching}
        />
      ) : null}
      {data && (
        <ExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          course={course}
          data={data}
        />
      )}
    </Card>
  );
};

export default Gradebook;

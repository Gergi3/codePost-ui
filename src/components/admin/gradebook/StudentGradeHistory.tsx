// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, Card, Empty, Flex, Spin, Tag, Timeline, Typography } from 'antd';
import { ArrowLeftOutlined, TrophyOutlined } from '@ant-design/icons';
import CPButton from '../../core/CPButton';
import { Course } from '../../../api-client';
import { useStudentGradeHistory, GradeSnapshot } from './queries';

const { Text, Title } = Typography;

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const personalBest = (snapshots: GradeSnapshot[]): string | null => {
  const grades = snapshots.map((s) => parseFloat(s.grade ?? 'NaN')).filter(Number.isFinite);
  if (grades.length === 0) return null;
  return String(Math.max(...grades));
};

interface Props {
  course: Course;
  courseURL: string;
}

const StudentGradeHistory: React.FC<Props> = ({ course, courseURL }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const student = params.get('student') ?? '';

  const { data, isLoading, isError } = useStudentGradeHistory(course.id, student || undefined);

  if (!student) {
    return <Alert type="error" message="No student specified." style={{ margin: 24 }} />;
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
        <CPButton icon={<ArrowLeftOutlined />} onClick={() => navigate(`${courseURL}/leaderboard`)}>
          Back to Leaderboard
        </CPButton>
        <Title level={4} style={{ margin: 0 }}>
          Grade History — <Text type="secondary">{student}</Text>
        </Title>
      </Flex>

      {isLoading && (
        <Flex justify="center" style={{ marginTop: 80 }}>
          <Spin size="large" />
        </Flex>
      )}

      {isError && (
        <Alert type="error" message="Failed to load grade history." style={{ marginTop: 16 }} />
      )}

      {data && data.length === 0 && (
        <Empty description="No assignments found for this course." />
      )}

      {data && data.map((item) => {
        const best = personalBest(item.snapshots);
        const hasHistory = item.snapshots.length > 0;

        return (
          <Card
            key={item.assignmentId}
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Flex justify="space-between" align="center">
                <span>
                  {item.submissionId ? (
                    <a href={`/code/${item.submissionId}`} target="_blank" rel="noopener noreferrer">
                      {item.assignmentName}
                    </a>
                  ) : (
                    item.assignmentName
                  )}
                  <Text type="secondary" style={{ marginLeft: 8, fontWeight: 'normal' }}>
                    / {item.assignmentPoints}
                  </Text>
                </span>
                {item.currentGrade != null && (
                  <Tag color={Number(item.currentGrade) >= Number(item.assignmentPoints) ? 'green' : 'blue'}>
                    {item.currentGrade}
                  </Tag>
                )}
              </Flex>
            }
          >
            {!hasHistory && (
              <Text type="secondary">No grade history recorded.</Text>
            )}
            {hasHistory && (
              <Timeline
                style={{ marginTop: 8 }}
                items={item.snapshots.map((snap, i) => {
                  const gradeVal = snap.grade != null ? parseFloat(snap.grade) : null;
                  const isBest = snap.grade === best;
                  const isFirst = i === 0;
                  const prevGrade = i > 0 ? parseFloat(item.snapshots[i - 1].grade ?? 'NaN') : null;
                  const improved = gradeVal != null && prevGrade != null && gradeVal > prevGrade;

                  return {
                    color: isBest ? 'green' : improved ? 'blue' : 'gray',
                    dot: isBest ? <TrophyOutlined style={{ color: '#52c41a' }} /> : undefined,
                    children: (
                      <Flex gap={12} align="baseline">
                        <Text strong style={{ minWidth: 40 }}>
                          {snap.grade ?? '—'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {fmt(snap.created)}
                        </Text>
                        {snap.seed && (
                          <Tag style={{ fontSize: 11 }}>backfilled</Tag>
                        )}
                        {!isFirst && improved && (
                          <Text type="success" style={{ fontSize: 12 }}>
                            +{(gradeVal! - prevGrade!).toFixed(2)}
                          </Text>
                        )}
                        {!isFirst && !improved && gradeVal != null && prevGrade != null && gradeVal < prevGrade && (
                          <Text type="danger" style={{ fontSize: 12 }}>
                            {(gradeVal - prevGrade).toFixed(2)}
                          </Text>
                        )}
                      </Flex>
                    ),
                  };
                })}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default StudentGradeHistory;

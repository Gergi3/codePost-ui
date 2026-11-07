// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { useState, useEffect, useCallback } from 'react';
import { Input, Typography, Button, message, Divider, Space, Switch, InputNumber } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { AssignmentType, TestCategoryType } from '../../../../../../types/models';
import { TestScriptEditor } from '../TestDefinitions/TestScriptEditor';
import { TestResourceManager } from './TestResourceManager';
import { TestFilesManager } from './TestFilesManager';
import { testCategoriesApi, testCasesApi } from '../../../../../../api-client/clients';
import type { PatchedTestCategory } from '../../../../../../api-client';

interface IProps {
  category: TestCategoryType;
  assignment: AssignmentType;
  language: string;
  onUpdate: (cat: TestCategoryType) => void;
}

export const TestCategoryUI = (props: IProps) => {
  const [name, setName] = useState(props.category.name);
  const [script, setScript] = useState(props.category.testScript || '');
  const [isSaving, setIsSaving] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [checkstylePoints, setCheckstylePoints] = useState<number>(2);
  const [checkstyleSaving, setCheckstyleSaving] = useState(false);

  useEffect(() => {
    setName(props.category.name);
    setScript(props.category.testScript || '');
  }, [props.category]);

  const refreshCategory = useCallback(async () => {
    try {
      const updated = (await testCategoriesApi.retrieve({
        id: props.category.id,
      })) as unknown as TestCategoryType;
      props.onUpdate(updated);
      setReloadNonce((n) => n + 1);
    } catch {
      /* non-fatal */
    }
  }, [props.category.id, props.onUpdate]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload: Omit<PatchedTestCategory, 'id' | 'testCases' | 'resources'> = {
        name,
        testScript: script,
      };
      await testCategoriesApi.partialUpdate({
        id: props.category.id,
        patchedTestCategory: payload,
      });
      await refreshCategory();
      message.success('Category saved');
    } catch (e) {
      console.error(e);
      message.error('Failed to save category');
    } finally {
      setIsSaving(false);
    }
  }, [name, script, props.category.id, refreshCategory]);

  // Keyboard shortcut Ctrl+S / Cmd+S — only active while this component is mounted
  // (i.e. Tests tab is active and a category is selected).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [handleSave]);

  const hasChanges =
    name !== props.category.name ||
    script !== (props.category.testScript || '');

  const isJava = props.language === 'java' || props.language.startsWith('java-') ||
    !!(props.category.testFiles && props.category.testFiles.length > 0);

  // Find existing checkstyle test case by fetching details — we just track its id in state.
  // We derive enabled from whether such a case exists after each refresh.
  const [checkstyleCaseId, setCheckstyleCaseId] = useState<number | null>(null);

  useEffect(() => {
    if (!isJava) return;
    const ids: number[] = props.category.testCases as unknown as number[] || [];
    if (ids.length === 0) { setCheckstyleCaseId(null); return; }
    // Fetch all test cases to find one with type=checkstyle
    Promise.all(ids.map((id) => testCasesApi.retrieve({ id }))).then((cases) => {
      const cs = cases.find((c) => (c as unknown as { type: string }).type === 'checkstyle');
      if (cs) {
        setCheckstyleCaseId(cs.id);
        setCheckstylePoints(Number((cs as unknown as { pointsPass: string }).pointsPass) || 2);
      } else {
        setCheckstyleCaseId(null);
      }
    }).catch(() => setCheckstyleCaseId(null));
  }, [props.category.testCases, isJava]);

  const handleCheckstyleToggle = useCallback(async (enabled: boolean) => {
    setCheckstyleSaving(true);
    try {
      if (enabled) {
        await testCasesApi.create({
          testCase: {
            testCategory: props.category.id,
            description: 'Checkstyle',
            type: 'checkstyle' as never,
            pointsPass: String(checkstylePoints),
            pointsFail: '0',
            text: '',
            sortKey: 0,
          } as never,
        });
        message.success('Checkstyle test added');
      } else if (checkstyleCaseId !== null) {
        await testCasesApi.destroy({ id: checkstyleCaseId });
        message.success('Checkstyle test removed');
      }
      await refreshCategory();
    } catch (e) {
      console.error(e);
      message.error('Failed to update checkstyle test');
    } finally {
      setCheckstyleSaving(false);
    }
  }, [props.category.id, checkstylePoints, checkstyleCaseId, refreshCategory]);

  const handleCheckstylePointsChange = useCallback(async (pts: number | null) => {
    if (pts === null || checkstyleCaseId === null) return;
    setCheckstylePoints(pts);
    try {
      await testCasesApi.partialUpdate({
        id: checkstyleCaseId,
        patchedTestCase: { pointsPass: String(pts) } as never,
      });
      message.success('Checkstyle points updated');
    } catch {
      message.error('Failed to update points');
    }
  }, [checkstyleCaseId]);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <div>
            <Space orientation="vertical">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Category Name
              </Typography.Text>
              <Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 300 }} />
            </Space>
          </div>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={isSaving} disabled={!hasChanges}>
          Save Changes
        </Button>
      </div>

      {/* Resources */}
      <div style={{ marginBottom: 16 }}>
        <TestResourceManager
          assignmentId={props.assignment.id}
          categoryId={props.category.id}
          resources={props.category.resources || []}
          onRefresh={async () => {
            try {
              const updated = (await testCategoriesApi.retrieve({
                id: props.category.id,
              })) as unknown as TestCategoryType;
              props.onUpdate(updated);
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </div>

      <Divider style={{ margin: '10px 0' }} />

      {/* Checkstyle — Java only */}
      {isJava && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Switch
            checked={checkstyleCaseId !== null}
            loading={checkstyleSaving}
            onChange={handleCheckstyleToggle}
          />
          <Typography.Text strong>Checkstyle</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Award points for zero code style violations (MJT rules)
          </Typography.Text>
          {checkstyleCaseId !== null && (
            <InputNumber
              min={0}
              max={100}
              value={checkstylePoints}
              onBlur={(e) => handleCheckstylePointsChange(parseFloat(e.target.value))}
              onPressEnter={(e) => handleCheckstylePointsChange(parseFloat((e.target as HTMLInputElement).value))}
              addonAfter="pts"
              style={{ width: 110 }}
            />
          )}
        </div>
      )}

      {/* Java: file sections with tests nested beneath each file */}
      {isJava && (
        <TestFilesManager
          category={props.category}
          categoryId={props.category.id}
          testFiles={props.category.testFiles || []}
          testCaseIds={props.category.testCases || []}
          reloadNonce={reloadNonce}
          onRefresh={refreshCategory}
          onPointsChanged={refreshCategory}
        />
      )}

      {/* Script editor — non-Java only */}
      {!isJava && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography.Text strong style={{ marginBottom: 10 }}>
            Test Script
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
            Write a script. Use <code>@test(name="Name", points=5)</code> to define tests.
          </Typography.Text>
          <div style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: 4 }}>
            <TestScriptEditor
              code={script}
              onChange={setScript}
              language="python"
              assignmentId={props.assignment.id}
              courseId={props.assignment.course}
              targetFileName=""
              contextFiles={[]}
              onRubricItemChange={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface IProps {
  category: TestCategoryType;
  assignment: AssignmentType;
  language: string;
  onUpdate: (cat: TestCategoryType) => void;
}


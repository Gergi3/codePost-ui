// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { useState, useEffect, useCallback } from 'react';
import { Input, Typography, Button, message, Divider, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { AssignmentType, TestCategoryType } from '../../../../../../types/models';
import { TestScriptEditor } from '../TestDefinitions/TestScriptEditor';
import { TestResourceManager } from './TestResourceManager';
import { TestFilesManager } from './TestFilesManager';
import { testCategoriesApi } from '../../../../../../api-client/clients';
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

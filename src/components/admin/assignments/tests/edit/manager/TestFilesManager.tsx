// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Button, Typography, Popconfirm, message, Drawer, Tag, InputNumber, Switch, Input, Spin } from 'antd';
import { DeleteOutlined, FileTextOutlined, EditOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { testCategoryFilesApi, testCasesApi } from '../../../../../../api-client/clients';
import type { TestCategoryFile } from '../../../../../../api-client';
import type { RcFile } from 'antd/es/upload';
import { loadIDList } from '../../../../../../utils/generics';
import { TestCaseType, TestCategoryType } from '../../../../../../types/models';
import Editor from '../../../../../../lib/monaco';

interface IProps {
  category: TestCategoryType;
  categoryId: number;
  testFiles: TestCategoryFile[];
  testCaseIds: number[];
  reloadNonce?: number;
  onRefresh: () => void;
  onPointsChanged?: () => void;
}

async function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** The class declared in a .java source (public preferred), matching the backend's
 *  className derivation. Falls back to the filename stem when no class is found. */
function deriveClassName(fileName: string, content: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const pub = content.match(/\bpublic\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (pub) return pub[1];
  const any = content.match(/\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (any) return any[1];
  return stem;
}

/** Extract @Test method names from Java source (simple regex, good enough for display). */
function extractTestMethods(content: string): string[] {
  const methods: string[] = [];
  const lines = content.split('\n');
  let nextIsTest = false;
  for (const line of lines) {
    if (/^\s*@Test\b/.test(line) || /^\s*@ParameterizedTest\b/.test(line) || /^\s*@RepeatedTest\b/.test(line)) {
      nextIsTest = true;
    } else if (nextIsTest) {
      const m = line.match(/(?:public|protected|private|static|\s)+\s+\w+\s+(\w+)\s*\(/);
      if (m) {
        methods.push(m[1]);
        nextIsTest = false;
      }
      // No method on this line (e.g. a further annotation like @ValueSource, or a
      // blank line) — keep looking on subsequent lines instead of giving up.
    }
  }
  return methods;
}

export const TestFilesManager = (props: IProps) => {
  const [uploading, setUploading] = useState(false);
  const [editingFile, setEditingFile] = useState<TestCategoryFile | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const editContentRef = useRef('');

  // Local display state for Max pts — kept in sync with category prop but
  // updated immediately on user input for a snappy feel.
  const [maxPts, setMaxPts] = useState<number>(Number(props.category.maxPoints ?? 0));
  const maxPtsEditingRef = useRef(false);  // true while user has focus on the input
  const maxPtsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Don't overwrite what the user is actively typing.
    if (!maxPtsEditingRef.current) {
      setMaxPts(Number(props.category.maxPoints ?? 0));
    }
  }, [props.category.maxPoints]);

  // Test cases loaded once and refreshed with reloadNonce.
  const [testCases, setTestCases] = useState<TestCaseType[]>([]);
  const [tcLoading, setTcLoading] = useState(false);
  const tcDebounce = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Accumulated unsaved field edits per test id, merged into one PATCH. Prevents a
  // second edit (e.g. points right after description) from dropping the first, and
  // lets us know when it's unsafe to reload from the server.
  const pendingPatches = useRef<Record<number, Record<string, unknown>>>({});

  const loadTestCases = useCallback(async () => {
    if (!props.testCaseIds || props.testCaseIds.length === 0) {
      setTestCases([]);
      return;
    }
    // Don't clobber edits that haven't been persisted yet (a reloadNonce bump can
    // race the debounced PATCH). Skip the reload while any patch is in flight.
    if (Object.keys(pendingPatches.current).length > 0) {
      return;
    }
    setTcLoading(true);
    try {
      const tests = await loadIDList<TestCaseType>(props.testCaseIds, {
        read: (id: number) => testCasesApi.retrieve({ id }) as unknown as Promise<TestCaseType>,
      });
      tests.sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0) || a.id - b.id);
      setTestCases(tests);
    } catch {
      message.error('Failed to load tests');
    } finally {
      setTcLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.testCaseIds.join(','), props.reloadNonce]);

  useEffect(() => {
    loadTestCases();
  }, [loadTestCases]);

  const patchTestCase = (id: number, patch: Record<string, unknown>, isPoints = false) => {
    setTestCases((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // Merge into any pending patch for this id so no field edit is lost when a second
    // edit arrives inside the debounce window.
    pendingPatches.current[id] = { ...pendingPatches.current[id], ...patch };
    if (tcDebounce.current[id]) clearTimeout(tcDebounce.current[id]);
    tcDebounce.current[id] = setTimeout(async () => {
      const merged = pendingPatches.current[id];
      delete pendingPatches.current[id];
      delete tcDebounce.current[id];
      try {
        await testCasesApi.partialUpdate({ id, patchedTestCase: merged as never });
        if (isPoints) props.onPointsChanged?.();
      } catch {
        message.error('Failed to save');
      }
    }, 500);
  };

  const handleMaxPointsChange = (newMax: number) => {
    if (testCases.length === 0) return;
    // Debounce: wait until user stops typing before redistributing.
    if (maxPtsDebounce.current) clearTimeout(maxPtsDebounce.current);
    maxPtsDebounce.current = setTimeout(() => {
      maxPtsDebounce.current = null;
      const n = testCases.length;
      const share = Math.round((newMax / n) * 100) / 100;
      // Capture ids before any async re-render.
      const ids = testCases.map((tc) => tc.id);
      // Patch each test with isPoints=false so we don't fire N refreshCategory calls.
      ids.forEach((id) => {
        patchTestCase(id, { pointsPass: share }, false);
      });
      // Single refresh after all patches are queued.
      props.onPointsChanged?.();
    }, 600);
  };

  const handleUploadFile = async (file: RcFile, targetId?: number): Promise<false> => {
    setUploading(true);
    try {
      const content = await readAsText(file as unknown as File);
      if (targetId !== undefined) {
        // Reupload: replace content of specific file by id.
        await testCategoryFilesApi.partialUpdate({ id: targetId, patchedTestCategoryFile: { content } });
        message.success(`Replaced ${file.name}`);
      } else {
        const existing = props.testFiles.find((f) => f.name === file.name);
        if (existing) {
          await testCategoryFilesApi.partialUpdate({ id: existing.id, patchedTestCategoryFile: { content } });
          message.success(`Replaced ${file.name}`);
        } else {
          await testCategoryFilesApi.create({
            testCategoryFile: { category: props.categoryId, name: file.name, content, sortKey: props.testFiles.length },
          });
          message.success(`Uploaded ${file.name}`);
        }
      }
      props.onRefresh();
    } catch {
      message.error(`Failed to upload ${file.name}`);
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      await testCategoryFilesApi.destroy({ id });
      message.success(`Deleted ${name}`);
      props.onRefresh();
    } catch {
      message.error(`Failed to delete ${name}`);
    }
  };

  const openEditor = (f: TestCategoryFile) => {
    setEditingFile(f);
    setEditContent(f.content || '');
    editContentRef.current = f.content || '';
  };

  const handleSave = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await testCategoryFilesApi.partialUpdate({
        id: editingFile.id,
        patchedTestCategoryFile: { content: editContentRef.current },
      });
      message.success('Saved');
      setEditingFile(null);
      props.onRefresh();
    } catch {
      message.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...props.testFiles].sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0) || a.id - b.id);
  const totalPoints = testCases.reduce((s, t) => s + Number(t.pointsPass ?? 0), 0);

  return (
    <div>
      {/* Compact header row: upload button + max points editor */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Upload
          multiple
          accept=".java"
          showUploadList={false}
          beforeUpload={(f) => handleUploadFile(f as RcFile)}
          disabled={uploading}
        >
          <Button icon={<PlusOutlined />} loading={uploading} size="small">
            {uploading ? 'Uploading…' : 'Add / replace .java files'}
          </Button>
        </Upload>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Typography.Text style={{ fontSize: 12, color: '#666' }}>Max pts:</Typography.Text>
          <InputNumber
            min={0}
            step={1}
            value={maxPts}
            onFocus={() => { maxPtsEditingRef.current = true; }}
            onBlur={() => { maxPtsEditingRef.current = false; }}
            onChange={(val) => {
              const v = Number(val ?? 0);
              setMaxPts(v);
              handleMaxPointsChange(v);
            }}
            style={{ width: 80, fontSize: 13 }}
            size="small"
          />
        </div>
      </div>

      {/* Per-file sections */}
      {sorted.map((f) => {
        const classStem = deriveClassName(f.name, f.content || '');
        const methods = extractTestMethods(f.content || '');
        // Prefer the authoritative className set by the parser; fall back to
        // method-name matching for tests parsed before className existed.
        const fileCases = testCases.filter((tc) =>
          tc.className
            ? tc.className === classStem
            : methods.includes(tc.functionName || '')
        );

        return (
          <div
            key={f.id}
            style={{ border: '1px solid #e8e8e8', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}
          >
            {/* File header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#fafafa',
                borderBottom: fileCases.length > 0 ? '1px solid #e8e8e8' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {f.name}
                </Typography.Text>
                <Tag color="blue" style={{ marginLeft: 4 }}>
                  {methods.length} @Test{methods.length !== 1 ? 's' : ''}
                </Tag>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {/* Reupload button */}
                <Upload
                  accept=".java"
                  showUploadList={false}
                  beforeUpload={(file) => handleUploadFile(file as RcFile, f.id)}
                  disabled={uploading}
                >
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    title="Re-upload this file"
                  />
                </Upload>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(f)} title="Edit inline" />
                <Popconfirm
                  title={`Delete ${f.name}?`}
                  onConfirm={() => handleDelete(f.id, f.name)}
                  okText="Delete"
                  cancelText="Cancel"
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            </div>

            {/* Tests for this file */}
            {tcLoading && fileCases.length === 0 && methods.length > 0 && (
              <div style={{ padding: '8px 16px' }}>
                <Spin size="small" />
              </div>
            )}
            {fileCases.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', color: '#555' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 500 }}>Display name</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500 }}>Method</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 500, width: 100 }}>Points</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 500, width: 80 }}>Hidden</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 500, width: 80 }}>Exposed</th>
                  </tr>
                </thead>
                <tbody>
                  {fileCases.map((tc, i) => (
                    <tr
                      key={tc.id}
                      style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                    >
                      <td style={{ padding: '6px 14px' }}>
                        <Input
                          value={tc.description ?? ''}
                          onChange={(e) => patchTestCase(tc.id, { description: e.target.value })}
                          placeholder="Display name"
                          bordered={false}
                          style={{ fontSize: 14, padding: '2px 0' }}
                        />
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <Typography.Text code style={{ fontSize: 13 }}>{tc.functionName}</Typography.Text>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <InputNumber
                          min={0}
                          step={1}
                          value={Number(tc.pointsPass ?? 1)}
                          onChange={(val) => patchTestCase(tc.id, { pointsPass: Number(val ?? 0) }, true)}
                          style={{ width: 72, fontSize: 14 }}
                        />
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <Switch
                          checked={!!tc.hidden}
                          onChange={(checked) => patchTestCase(tc.id, { hidden: checked })}
                        />
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <Switch
                          checked={!!tc.exposed}
                          onChange={(checked) => patchTestCase(tc.id, { exposed: checked })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Show if file has @Test methods but no matched test cases yet */}
            {!tcLoading && fileCases.length === 0 && methods.length > 0 && (
              <div style={{ padding: '8px 16px', color: '#999', fontSize: 12 }}>
                Tests not yet synced — save the file to trigger re-parse.
              </div>
            )}
          </div>
        );
      })}

      {/* Unmatched test cases (shouldn't happen normally, safety net) */}
      {(() => {
        if (testCases.length === 0 || sorted.length === 0) return null;
        const classStems = new Set(sorted.map((f) => deriveClassName(f.name, f.content || '')));
        const allMethods = sorted.flatMap((f) => extractTestMethods(f.content || ''));
        const unmatched = testCases.filter((tc) =>
          tc.className
            ? !classStems.has(tc.className)
            : !allMethods.includes(tc.functionName || '')
        );
        if (unmatched.length === 0) return null;
        return (
          <div style={{ border: '1px dashed #e8e8e8', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {unmatched.length} test{unmatched.length !== 1 ? 's' : ''} not linked to any file
            </Typography.Text>
            {unmatched.map((tc) => (
              <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Typography.Text code style={{ fontSize: 11 }}>{tc.functionName}</Typography.Text>
                <Typography.Text style={{ fontSize: 12 }}>{tc.description}</Typography.Text>
              </div>
            ))}
          </div>
        );
      })()}

      {testCases.length > 0 && (
        <div style={{ textAlign: 'right', color: '#666', fontSize: 12, marginBottom: 8 }}>
          Total: <strong>{totalPoints} pts</strong> across {testCases.length} test{testCases.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Inline editor drawer */}
      <Drawer
        title={editingFile ? `Edit: ${editingFile.name}` : ''}
        placement="right"
        width="60%"
        open={!!editingFile}
        onClose={() => setEditingFile(null)}
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}>
            Save
          </Button>
        }
        destroyOnClose
      >
        <div style={{ height: 'calc(100vh - 120px)' }}>
          <Editor
            height="100%"
            defaultLanguage="java"
            value={editContent}
            onChange={(val) => {
              editContentRef.current = val || '';
              setEditContent(val || '');
            }}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: "'Fira Code', 'Courier New', monospace",
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>
      </Drawer>
    </div>
  );
};

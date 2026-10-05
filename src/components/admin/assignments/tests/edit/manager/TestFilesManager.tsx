// Copyright © 2026 Rutgers, the State University of New Jersey. All rights reserved except as defined by the Rutgers Non-Commercial License, included with this software.
import { useState } from 'react';
import { Upload, List, Button, Typography, Popconfirm, message, Tag } from 'antd';
import { InboxOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import { testCategoryFilesApi } from '../../../../../../api-client/clients';
import type { TestCategoryFile } from '../../../../../../api-client';
import type { RcFile } from 'antd/es/upload';

interface IProps {
  categoryId: number;
  /** Already-fetched testFiles from the category serializer (avoids a blocked list() call). */
  testFiles: TestCategoryFile[];
  /** Called after any create/delete so the parent re-fetches the category. */
  onRefresh: () => void;
}

async function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Manages the TestCategoryFile rows for one category: drag-drop upload of .java
 * files (one file → one TestCategoryFile row → backend sync creates TestCase
 * rows), plus per-file delete. Files are passed as a prop (from the nested
 * testFiles on the category response) so no extra list() call is needed.
 */
export const TestFilesManager = (props: IProps) => {
  const [uploading, setUploading] = useState(false);

  const sorted = [...props.testFiles].sort(
    (a, b) => (a.sortKey || 0) - (b.sortKey || 0) || a.id - b.id,
  );

  const handleUpload = async (file: RcFile): Promise<false> => {
    setUploading(true);
    try {
      const content = await readAsText(file as unknown as File);
      await testCategoryFilesApi.create({
        testCategoryFile: {
          category: props.categoryId,
          name: file.name,
          content,
          sortKey: props.testFiles.length,
        },
      });
      message.success(`Uploaded ${file.name}`);
      props.onRefresh();
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err?.status === 400) {
        message.warning(`${file.name} already exists — delete it first to replace.`);
      } else {
        message.error(`Failed to upload ${file.name}`);
      }
    } finally {
      setUploading(false);
    }
    return false; // prevent antd's default XHR upload
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

  return (
    <div>
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        Test Files
      </Typography.Text>

      <Upload.Dragger
        multiple
        accept=".java"
        showUploadList={false}
        beforeUpload={handleUpload}
        disabled={uploading}
        style={{ marginBottom: 12 }}
      >
        <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {uploading ? 'Uploading…' : 'Click or drag .java test files here'}
        </p>
        <p className="ant-upload-hint">
          Each file becomes one test class. <code>@Test</code> methods are parsed into tests automatically.
        </p>
      </Upload.Dragger>

      <List
        size="small"
        dataSource={sorted}
        locale={{ emptyText: 'No test files yet' }}
        renderItem={(f) => {
          const testCount = (f.content || '').split('\n')
            .filter((l: string) => /^\s*@Test\b/.test(l)).length;
          return (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title={`Delete ${f.name}?`}
                  onConfirm={() => handleDelete(f.id, f.name)}
                  okText="Delete"
                  cancelText="Cancel"
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined />}
                title={f.name}
                description={
                  testCount > 0 ? (
                    <Tag color="blue">{testCount} @Test method{testCount !== 1 ? 's' : ''}</Tag>
                  ) : null
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
};

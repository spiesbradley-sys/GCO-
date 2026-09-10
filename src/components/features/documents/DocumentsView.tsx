'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { DataTable, type Column } from '@/components/table/DataTable';
import { Button } from '@/components/ui/Button';
import { StatusBadge, DOCUMENT_STATUS } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { IconUpload, IconDocument } from '@/components/ui/icons';
import { formatDate } from '@/lib/utils';
import { registerDocument } from '@/actions/documents';

export type DocRow = {
  id: string;
  name: string;
  type: string | null;
  period: string | null;
  uploadedBy: string;
  createdAt: string;
  status: keyof typeof DOCUMENT_STATUS;
};

const MAX_MB = 25;

export function DocumentsView({ rows, canUpload }: { rows: DocRow[]; canUpload: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, start] = useTransition();

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`That file is over ${MAX_MB} MB. Split it or send it through the secure drop.`);
      return;
    }
    start(async () => {
      const res = await registerDocument({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      if (res.ok) {
        toast.success('Document received. We’ll review it shortly.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Upload failed. Try again.');
      }
    });
  }

  const columns: Column<DocRow>[] = [
    { key: 'name', header: 'Name', sticky: true, render: (r) => <span className="font-semibold">{r.name}</span> },
    { key: 'type', header: 'Type', render: (r) => r.type ?? '—' },
    { key: 'period', header: 'Period', render: (r) => r.period ?? '—' },
    { key: 'uploadedBy', header: 'Uploaded by' },
    { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.createdAt) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge tone={DOCUMENT_STATUS[r.status].tone}>{DOCUMENT_STATUS[r.status].label}</StatusBadge>
      ),
    },
    {
      key: 'download',
      header: '',
      align: 'right',
      // Downloads must go through an authenticated, signed, short-lived URL —
      // never an unauthenticated preview link. Wired server-side (TODO).
      render: () => (
        <Button variant="ghost" size="sm" onClick={() => toast.info('Preparing a secure download…')}>
          Download
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors duration-fast ease-standard',
            dragOver
              ? 'border-accent-secondary bg-favorable-tint'
              : 'border-border-default bg-surface-report',
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-cream text-accent-primary">
            <IconUpload width={20} height={20} />
          </span>
          <p className="text-[15px] font-semibold text-ink">Drop a file here, or choose one</p>
          <p className="text-[13px] text-ink-tertiary">PDF, CSV, XLSX or image · up to {MAX_MB} MB</p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            accept=".pdf,.csv,.xlsx,.png,.jpg,.jpeg"
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-1"
            loading={pending}
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
        </div>
      )}

      <DataTable
        caption="Documents"
        columns={columns}
        rows={rows}
        empty={
          <EmptyState
            icon={<IconDocument width={22} height={22} />}
            title="No documents yet"
            body="Upload the month's bank statements to start the close."
            action={
              canUpload ? (
                <Button size="sm" onClick={() => inputRef.current?.click()}>
                  Upload statements
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}

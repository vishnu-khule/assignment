import { useRef, useState } from "react";
import { api } from "../lib/api";
import type { AttachmentChip } from "./AttachmentChips";

export function Composer({
  disabled,
  sessionId,
  onSend,
  onGenerate,
  canGenerate,
  onAttachmentChange,
  onUploadComplete,
}: {
  disabled?: boolean;
  sessionId?: string | null;
  onSend: (text: string) => void;
  onGenerate: () => void;
  canGenerate?: boolean;
  onAttachmentChange?: (chips: AttachmentChip[]) => void;
  onUploadComplete?: () => void;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [localChips, setLocalChips] = useState<AttachmentChip[]>([]);

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    await Promise.allSettled(files.map((file) => handleFile(file)));
    onUploadComplete?.();
  }

  async function handleFile(file: File) {
    if (!sessionId) return;
    const chipId = crypto.randomUUID();
    setLocalChips((prev) => {
      const next = [
        ...prev,
        { id: chipId, filename: file.name, status: "uploading" as const },
      ];
      onAttachmentChange?.(next);
      return next;
    });
    try {
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'B',location:'Composer.tsx:upload_start',message:'file upload started',data:{sessionId,filename:file.name,size:file.size},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const presign = await api.presign(
        sessionId,
        file.name,
        file.type || "application/octet-stream",
      );
      if (presign.local_dev) {
        await api.uploadLocal(presign.attachment_id, file);
      } else {
        await fetch(presign.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        await api.completeUpload(presign.attachment_id);
      }
      setLocalChips((prev) => {
        const next = prev
          .filter((c) => c.id !== chipId)
          .concat({
            id: presign.attachment_id,
            filename: file.name,
            status: "ingesting" as const,
          });
        onAttachmentChange?.(next);
        return next;
      });
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'B',location:'Composer.tsx:upload_ok',message:'file upload queued ingest',data:{attachmentId:presign.attachment_id,localDev:!!presign.local_dev},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7267/ingest/5ad854ac-1ea5-4fed-88dd-abcc7750f266',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'260b82'},body:JSON.stringify({sessionId:'260b82',hypothesisId:'B',location:'Composer.tsx:upload_fail',message:'file upload failed',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setLocalChips((prev) => {
        const next = prev.map((c) =>
          c.id === chipId ? { ...c, status: "failed" as const } : c,
        );
        onAttachmentChange?.(next);
        return next;
      });
    }
  }

  return (
    <footer className="border-t border-slate-200 bg-white p-3">
      {canGenerate && (
        <button
          type="button"
          className="mb-2 w-full rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white disabled:opacity-60"
          onClick={onGenerate}
        >
          Generate Basic · Modern · Premium
        </button>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onSend(text.trim());
          setText("");
        }}
      >
        <div className="flex flex-1 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <textarea
            className="min-h-10 w-full resize-none bg-transparent px-1 text-sm outline-none"
            placeholder="Describe the job or answer questions…"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Attach files"
              className="rounded-lg px-2 py-1 text-base hover:bg-white"
              onClick={() => fileRef.current?.click()}
              disabled={!sessionId}
            >
              📎
            </button>
            <button
              type="button"
              title="Voice input (coming soon)"
              className="rounded-lg px-2 py-1 text-base opacity-40"
              disabled
            >
              🎤
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              onChange={(e) => {
                const list = e.target.files;
                if (list?.length) {
                  handleFiles(Array.from(list)).catch(console.error);
                }
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </footer>
  );
}

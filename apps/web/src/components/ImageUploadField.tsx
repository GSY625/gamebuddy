import { useId, useRef, useState } from 'react';

type Props = {
  urls: string[];
  maxImages: number;
  label?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: (url: string) => void;
};

export function ImageUploadField({
  urls,
  maxImages,
  label = '荣誉截图',
  onUpload,
  onRemove,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState('');

  const canAdd = urls.length < maxImages;

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('请选择图片文件（JPG / PNG 等）');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLocalError('单张图片不能超过 5MB');
      return;
    }
    setLocalError('');
    setUploading(true);
    try {
      await onUpload(file);
    } catch {
      setLocalError('上传失败，请稍后重试');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!canAdd || uploading) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="image-upload-field">
      {urls.length > 0 && (
        <div className="image-upload-grid">
          {urls.map((u) => (
            <div key={u} className="image-upload-card glass-panel">
              <img src={u} alt={`${label}预览`} />
              <button
                type="button"
                className="image-upload-remove"
                onClick={() => onRemove(u)}
                aria-label="删除图片"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div
          className={`image-upload-zone glass-panel ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="image-upload-input-hidden"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="image-upload-zone-inner">
            <span className="image-upload-icon" aria-hidden>
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect
                  x="6"
                  y="10"
                  width="36"
                  height="28"
                  rx="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="18" cy="22" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M6 32l10-10 8 8 6-6 12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M32 14h8v8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            {uploading ? (
              <p className="image-upload-title">上传中…</p>
            ) : (
              <>
                <p className="image-upload-title">点击或拖拽上传{label}</p>
                <p className="image-upload-hint muted">
                  支持 JPG / PNG / WebP，单张 ≤ 5MB
                </p>
                <span className="image-upload-badge">
                  {urls.length} / {maxImages} 张
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {!canAdd && (
        <p className="image-upload-full muted">
          已上传 {maxImages} 张，可删除后重新添加
        </p>
      )}

      {localError && <p className="error image-upload-error">{localError}</p>}
    </div>
  );
}

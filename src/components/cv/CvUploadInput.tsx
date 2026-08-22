'use client';

import React, { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface CvUploadInputProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  onError?: (msg: string | null) => void;
  disabled?: boolean;
  helperText?: string;
}

export default function CvUploadInput({
  file,
  onFileSelect,
  onError,
  disabled = false,
  helperText = 'Supports Adobe PDF (.pdf) and Microsoft Word (.docx)'
}: CvUploadInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (f: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const isDocx = f.name.toLowerCase().endsWith('.docx');
    const isPdf = f.name.toLowerCase().endsWith('.pdf');

    if (!validTypes.includes(f.type) && !isDocx && !isPdf) {
      if (onError) onError('Please upload a valid PDF or DOCX resume document.');
      return;
    }

    if (f.size > 10 * 1024 * 1024) {
      if (onError) onError('File size exceeds 10MB limit.');
      return;
    }

    if (onError) onError(null);
    onFileSelect(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={disabled}
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
      />

      {!file ? (
        <div
          onClick={() => {
            if (!disabled) fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-7 sm:p-8 text-center transition-all select-none ${
            disabled
              ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50/50'
              : isDragOver
              ? 'border-indigo-600 bg-indigo-50/50 cursor-pointer shadow-inner'
              : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50 cursor-pointer'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Click to browse or drag and drop your CV file here
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {helperText} (Max 10MB)
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onFileSelect(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Remove selected file"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Upload } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

type FileUploadFieldProps = {
  name: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  buttonText?: string;
  className?: string;
  initialFileLabel?: string;
  onFilesChange?: (files: File[]) => void;
};

export function FileUploadField({
  name,
  accept,
  required = false,
  multiple = false,
  buttonText = "Загрузить файл",
  className,
  initialFileLabel,
  onFilesChange,
}: FileUploadFieldProps) {
  const inputId = useId();
  const [fileNames, setFileNames] = useState<string[]>(
    initialFileLabel ? [initialFileLabel] : [],
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <input
        id={inputId}
        accept={accept}
        className="sr-only"
        multiple={multiple}
        name={name}
        required={required}
        type="file"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          setFileNames(files.map((file) => file.name));
          onFilesChange?.(files);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1157ff] px-4 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
          htmlFor={inputId}
        >
          <Upload size={17} />
          {buttonText}
        </label>
        {fileNames.length > 0 ? (
          <span className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200">
            {fileNames.join(", ")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

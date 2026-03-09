export type ProcessingStatus = 'ready' | 'processing' | 'done' | 'error';

export interface UploadedFile {
  id: string;
  file: File;
  base64: string;
  status: ProcessingStatus;
  prompt: string;
  error?: string;
}

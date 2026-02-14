import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from './supabaseClient';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
};

type UploadResult = {
  fileUrl: string;
  filePath: string;
  fileName: string;
  originalName: string;
};

const uploadToSupabase = async (
  file: UploadedFile,
  configService: ConfigService,
  folder = 'files',
): Promise<UploadResult> => {
  if (!file?.buffer) throw new Error('File not provided');

  const supabase = getSupabaseClient(configService);

  const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = `${folder}/${Date.now()}-${safeFileName}`;

  const { error } = await supabase.storage
    .from('attachments')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);

  return {
    fileUrl: data.publicUrl,
    filePath,
    fileName: safeFileName,
    originalName: file.originalname,
  };
};

export const uploadFileToSupabase = async (
  file: UploadedFile,
  configService: ConfigService,
  folder = 'files',
) => {
  return uploadToSupabase(file, configService, folder);
};

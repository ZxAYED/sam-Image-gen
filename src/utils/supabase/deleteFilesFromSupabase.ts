import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from './supabaseClient';

export const deleteFilesFromSupabase = async (
  filePaths: string[],
  configService: ConfigService,
) => {
  if (!filePaths.length) {
    return;
  }

  const supabase = getSupabaseClient(configService);
  const { error } = await supabase.storage
    .from('attachments')
    .remove(filePaths);

  if (error) {
    throw error;
  }
};

import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';

export interface SaveFileOptions {
  suggestedName: string;
  description: string;
  mimeType: string;
  extensions: string[];
}

/**
 * 调用 Tauri 原生 Windows「另存为」系统对话框，支持自由选择目录与重命名保存。
 * 返回 true 表示已保存，false 表示用户主动取消。
 */
export async function saveFileWithPicker(
  content: Uint8Array | string,
  options: SaveFileOptions,
): Promise<boolean> {
  const cleanExts = options.extensions.map((ext) => ext.replace(/^\./, ''));
  const filePath = await save({
    defaultPath: options.suggestedName,
    filters: [
      {
        name: options.description,
        extensions: cleanExts,
      },
    ],
  });

  if (!filePath) {
    return false;
  }

  if (typeof content === 'string') {
    await writeTextFile(filePath, content);
  } else {
    await writeFile(filePath, content);
  }
  return true;
}

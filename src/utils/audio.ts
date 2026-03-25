
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function saveAudioToFile(file: File): Promise<string> {
  const base64 = await fileToBase64(file);

  const fileName = 'alarm.mp3';

  await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Data,
  });

  const uri = await Filesystem.getUri({
    directory: Directory.Data,
    path: fileName,
  });

  return uri.uri;
}

// helper
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

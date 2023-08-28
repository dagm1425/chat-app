export function formatFilename(filename) {
  if (filename.length <= 20) {
    return filename;
  } else {
    const begName = filename.substring(0, 12);
    const endName = filename.substring(filename.length - 8);
    return begName + "..." + endName;
  }
}

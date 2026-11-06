/**
 * Hands one object URL to the browser as a download under `name`. The anchor is
 * in the document when it is clicked, because Firefox drops a click on a
 * detached node, and the URL is revoked on a later task so the transfer has the
 * blob before it disappears. Removal and revocation run even when the click
 * throws, so a refused download leaks neither the node nor the bytes.
 */
export const downloadBlob = (url: string, name: string): void => {
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  link.rel = 'noopener';

  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

import { zipSync } from 'fflate'

export interface DownloadFile {
  readonly name: string
  readonly blob: Blob
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Junta os vídeos num ZIP sem recomprimir (vídeo já é comprimido; só agrupa). */
export async function zipFiles(files: readonly DownloadFile[]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const file of files) entries[file.name] = [new Uint8Array(await file.blob.arrayBuffer()), { level: 0 }]
  return new Blob([new Uint8Array(zipSync(entries))], { type: 'application/zip' })
}

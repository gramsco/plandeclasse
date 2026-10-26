/** Recadre au carré (centre) et réduit à `taille` px, JPEG. */
export async function redimensionnerPhoto(file: Blob, taille = 200, qualite = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const c = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = taille
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, (bmp.width - c) / 2, (bmp.height - c) / 2, c, c, 0, 0, taille, taille)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encodage JPEG impossible'))), 'image/jpeg', qualite),
  )
}

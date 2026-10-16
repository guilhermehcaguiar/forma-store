import multer from 'multer'
import { mkdirSync } from 'node:fs'
import { readFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { badRequest, HttpError } from '../utils/httpError.js'

export const uploadDirectory = fileURLToPath(new URL('../../.local/uploads/', import.meta.url))
mkdirSync(uploadDirectory, { recursive: true })
const extensions = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirectory),
  filename: (_req, file, cb) => cb(null, randomUUID() + extensions[file.mimetype]),
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 25, fieldSize: 50 * 1024 },
  fileFilter: (_req, file, cb) => extensions[file.mimetype] ? cb(null, true) : cb(badRequest('imagem_invalida', 'Envie imagens PNG, JPEG ou WebP.')),
})
export async function discardUploads(files = []) {
  await Promise.all(files.map(file => unlink(file.path).catch(() => {})))
}
async function verifyImages(files) {
  for (const file of files) {
    const bytes = await readFile(file.path)
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    if (!({ 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp })[file.mimetype]) throw badRequest('imagem_invalida', 'O conteúdo do arquivo não corresponde ao formato de imagem informado.')
  }
}
export function productUpload(req, res, next) {
  upload.array('images', 5)(req, res, async error => {
    try {
      if (error) throw error instanceof multer.MulterError
        ? new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'upload_invalido', 'Envie até cinco imagens de no máximo 5 MB e campos dentro dos limites.')
        : error
      await verifyImages(req.files ?? [])
      next()
    } catch (failure) { await discardUploads(req.files); next(failure) }
  })
}

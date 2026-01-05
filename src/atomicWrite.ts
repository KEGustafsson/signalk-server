import fs from 'fs'

export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmp = filePath + '.tmp'
  try {
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, filePath)
  } catch (err) {
    try { fs.unlinkSync(tmp) } catch {}
    throw err
  }
}

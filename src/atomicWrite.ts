/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Copyright 2026 Signal K Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs'

/**
 * Atomically write data to a file using write-then-rename pattern.
 * Writes to a temporary file first, then renames to the target path.
 * This prevents partial writes on crash or power loss.
 *
 * @param filePath - The target file path
 * @param data - The data to write
 * @param callback - Callback function (err) => void
 */
export function atomicWriteFile(
  filePath: string,
  data: string | Buffer,
  callback: (err?: Error) => void
): void {
  const tempPath = filePath + '.tmp'
  fs.writeFile(tempPath, data, (writeErr) => {
    if (writeErr) {
      return callback(writeErr)
    }
    fs.rename(tempPath, filePath, (renameErr) => {
      if (renameErr) {
        fs.unlink(tempPath, () => callback(renameErr))
      } else {
        callback()
      }
    })
  })
}

/**
 * Synchronously atomically write data to a file using write-then-rename pattern.
 * Writes to a temporary file first, then renames to the target path.
 * This prevents partial writes on crash or power loss.
 *
 * @param filePath - The target file path
 * @param data - The data to write
 * @throws Error if write or rename fails
 */
export function atomicWriteFileSync(
  filePath: string,
  data: string | Buffer
): void {
  const tempPath = filePath + '.tmp'
  try {
    fs.writeFileSync(tempPath, data)
    fs.renameSync(tempPath, filePath)
  } catch (err) {
    try {
      fs.unlinkSync(tempPath)
    } catch {}
    throw err
  }
}

/**
 * Atomically write data to a file using write-then-rename pattern (async/await).
 * Writes to a temporary file first, then renames to the target path.
 * This prevents partial writes on crash or power loss.
 *
 * @param filePath - The target file path
 * @param data - The data to write
 * @throws Error if write or rename fails
 */
export async function atomicWriteFileAsync(
  filePath: string,
  data: string | Buffer
): Promise<void> {
  const tempPath = filePath + '.tmp'
  try {
    await fs.promises.writeFile(tempPath, data)
    await fs.promises.rename(tempPath, filePath)
  } catch (err) {
    try {
      await fs.promises.unlink(tempPath)
    } catch {}
    throw err
  }
}

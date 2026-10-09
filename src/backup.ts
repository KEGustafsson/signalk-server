import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import unzipper from 'unzipper'

const S_IFMT = 0o170000
const S_IFLNK = 0o120000

interface Link {
  path: string
  target: string
}

// Extracts a settings backup, keeping the symbolic links that pnpm builds
// node_modules from. Every file and directory is written before any link
// exists, so no write passes through a link, and the directory of each link
// is a real one. A link is kept only when it leads inside the target
// directory; a check of its own target is not enough, as it can reach
// further through other links.
export async function extractBackup(zipFile: string, targetDir: string) {
  fs.mkdirSync(targetDir, { recursive: true })
  const base = fs.realpathSync.native(targetDir)
  const directory = await unzipper.Open.file(zipFile)
  const links: Link[] = []
  for (const entry of directory.files) {
    const target = path.resolve(base, entry.path)
    if (!isInside(base, target)) {
      console.error(`Zip slip attempt blocked: ${entry.path}`)
      continue
    }
    if (entry.type === 'Directory') {
      fs.mkdirSync(target, { recursive: true })
      continue
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK) {
      links.push({ path: target, target: (await entry.buffer()).toString() })
    } else {
      await pipeline(entry.stream(), fs.createWriteStream(target))
    }
  }
  const created = links.filter((link) => createLink(base, link))
  removeLinksLeadingOutside(base, created)
}

function createLink(base: string, link: Link): boolean {
  const name = path.relative(base, link.path)
  if (
    path.isAbsolute(link.target) ||
    !isInside(base, path.resolve(path.dirname(link.path), link.target))
  ) {
    console.error(`Link outside the backup blocked: ${name}`)
    return false
  }
  try {
    fs.symlinkSync(link.target, link.path)
    return true
  } catch (err) {
    console.error(`Link ${name} not restored: ${(err as Error).message}`)
    return false
  }
}

// Removing a link can leave others that led through it dangling, so the
// check repeats until every remaining link resolves inside.
function removeLinksLeadingOutside(base: string, links: Link[]) {
  let remaining = links
  let removed = true
  while (removed) {
    removed = false
    remaining = remaining.filter((link) => {
      if (resolvesInside(base, link.path)) {
        return true
      }
      console.error(
        `Link outside the backup removed: ${path.relative(base, link.path)}`
      )
      fs.unlinkSync(link.path)
      removed = true
      return false
    })
  }
}

// The native realpath follows each link before applying the '..' after it,
// as the kernel does; fs.realpathSync resolves link targets by name.
function resolvesInside(base: string, linkPath: string): boolean {
  try {
    return isInside(base, fs.realpathSync.native(linkPath))
  } catch {
    return false
  }
}

function isInside(base: string, p: string): boolean {
  return p.startsWith(base + path.sep)
}

import archiver from 'archiver'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { extractBackup } from '../src/backup'

// A backup of a config directory with a pnpm node_modules: the plugin entry
// is a link into the virtual store, as are the plugin's dependencies there
function writeBackup(zipFile: string, sourceDir: string): Promise<void> {
  const pluginDir = path.join(
    sourceDir,
    'node_modules/.pnpm/plugin@1.0.0/node_modules/plugin'
  )
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports = 1\n')
  fs.writeFileSync(path.join(sourceDir, 'settings.json'), '{}\n')
  fs.symlinkSync(
    '.pnpm/plugin@1.0.0/node_modules/plugin',
    path.join(sourceDir, 'node_modules/plugin')
  )
  fs.symlinkSync('../../../../../../outside', path.join(pluginDir, 'escape'))

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFile)
    const archive = archiver('zip')
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(path.join(sourceDir, 'node_modules'), 'node_modules')
    archive.file(path.join(sourceDir, 'settings.json'), {
      name: 'settings.json'
    })
    archive.finalize()
  })
}

// A backup built entry by entry, for archives a real backup never contains
function writeArchive(
  zipFile: string,
  fill: (archive: archiver.Archiver) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFile)
    const archive = archiver('zip')
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    fill(archive)
    archive.finalize()
  })
}

describe('extractBackup', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), '_skservertest_backup'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('restores the links pnpm builds node_modules from', async () => {
    const zipFile = path.join(root, 'backup.zip')
    await writeBackup(zipFile, path.join(root, 'source'))
    const target = path.join(root, 'restored')

    await extractBackup(zipFile, target)

    expect(
      fs.readFileSync(path.join(target, 'settings.json'), 'utf8')
    ).to.equal('{}\n')
    const link = path.join(target, 'node_modules/plugin')
    expect(fs.lstatSync(link).isSymbolicLink()).to.equal(true)
    expect(fs.readlinkSync(link)).to.equal(
      '.pnpm/plugin@1.0.0/node_modules/plugin'
    )
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require(link)).to.equal(1)
  })

  it('leaves out links that point outside the backup', async () => {
    const zipFile = path.join(root, 'backup.zip')
    await writeBackup(zipFile, path.join(root, 'source'))
    const target = path.join(root, 'restored')

    await extractBackup(zipFile, target)

    const escape = path.join(
      target,
      'node_modules/.pnpm/plugin@1.0.0/node_modules/plugin/escape'
    )
    expect(() => fs.lstatSync(escape)).to.throw(/ENOENT/)
  })

  // s/t/u/y leads to s, so s/t/u/v/x, whose own target stays inside by
  // name, actually leads two levels above the restore directory
  const chainedLinks = (archive: archiver.Archiver) => {
    archive.symlink('s/t/u/y', '../..')
    archive.symlink('s/t/u/v/x', '../y/../../..')
  }

  it('removes a link that leads outside through another link', async () => {
    const zipFile = path.join(root, 'backup.zip')
    await writeArchive(zipFile, chainedLinks)
    const target = path.join(root, 'restored')

    await extractBackup(zipFile, target)

    expect(fs.readlinkSync(path.join(target, 's/t/u/y'))).to.equal('../..')
    expect(() => fs.lstatSync(path.join(target, 's/t/u/v/x'))).to.throw(
      /ENOENT/
    )
  })

  it('never writes a file through a link', async () => {
    const zipFile = path.join(root, 'backup.zip')
    await writeArchive(zipFile, (archive) => {
      chainedLinks(archive)
      archive.append('escaped', { name: 's/t/u/v/x/evil' })
    })
    const target = path.join(root, 'restored')

    await extractBackup(zipFile, target)

    const written = path.join(target, 's/t/u/v/x/evil')
    expect(fs.readFileSync(written, 'utf8')).to.equal('escaped')
    expect(fs.lstatSync(path.dirname(written)).isDirectory()).to.equal(true)
    expect(fs.readdirSync(root).sort()).to.deep.equal([
      'backup.zip',
      'restored'
    ])
  })

  it('leaves out links with an absolute target', async () => {
    const zipFile = path.join(root, 'backup.zip')
    const target = path.join(root, 'restored')
    await writeArchive(zipFile, (archive) => {
      archive.symlink('absolute', path.join(target, 'elsewhere'))
    })

    await extractBackup(zipFile, target)

    expect(() => fs.lstatSync(path.join(target, 'absolute'))).to.throw(/ENOENT/)
  })
})

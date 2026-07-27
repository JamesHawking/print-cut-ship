import { describe, expect, test } from 'bun:test'
import {
  MAX_FILE_BYTES,
  classifyFile,
  partitionFiles,
  type FileKind,
} from './upload'

// A File whose size we control without allocating 100 MB.
function fakeFile(name: string, size = 1024): File {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('classifyFile', () => {
  test.each<[string, FileKind]>([
    ['part.stl', 'stl'],
    ['part.STL', 'stl'],
    ['mesh.obj', 'obj'],
    ['plate.3mf', '3mf'],
    ['solid.step', 'step'],
    ['solid.stp', 'step'],
    ['sketch.dwg', 'unsupported'],
    ['archive.zip', 'unsupported'],
    ['noextension', 'unsupported'],
    // Only the last segment counts — a decoy extension must not pass.
    ['solid.step.txt', 'unsupported'],
  ])('%s → %s', (name, kind) => {
    expect(classifyFile(name)).toBe(kind)
  })
})

describe('partitionFiles', () => {
  test('splits by extension and records the reason', () => {
    const { accepted, rejected } = partitionFiles([
      fakeFile('a.stl'),
      fakeFile('sketch.dwg'),
      fakeFile('b.3mf'),
    ])
    expect(accepted.map((f) => f.name)).toEqual(['a.stl', 'b.3mf'])
    expect(rejected).toEqual([{ reason: 'type', fileName: 'sketch.dwg' }])
  })

  test('the size limit is inclusive', () => {
    const at = partitionFiles([fakeFile('at.stl', MAX_FILE_BYTES)])
    expect(at.accepted).toHaveLength(1)
    expect(at.rejected).toHaveLength(0)

    const over = partitionFiles([fakeFile('over.stl', MAX_FILE_BYTES + 1)])
    expect(over.accepted).toHaveLength(0)
    expect(over.rejected).toEqual([{ reason: 'size', fileName: 'over.stl' }])
  })

  test('type is checked before size — a huge .dwg reads as the wrong type', () => {
    const { rejected } = partitionFiles([
      fakeFile('huge.dwg', MAX_FILE_BYTES * 2),
    ])
    expect(rejected[0].reason).toBe('type')
  })

  test('empty input yields empty partitions', () => {
    expect(partitionFiles([])).toEqual({ accepted: [], rejected: [] })
  })
})

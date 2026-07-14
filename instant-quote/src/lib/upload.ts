// File classification and limits for the uploader.

export const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB
export const MAX_PARTS = 5

export type FileKind = 'stl' | 'obj' | '3mf' | 'step' | 'unsupported'

export function classifyFile(fileName: string): FileKind {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  switch (ext) {
    case 'stl':
      return 'stl'
    case 'obj':
      return 'obj'
    case '3mf':
      return '3mf'
    case 'step':
    case 'stp':
      return 'step'
    default:
      return 'unsupported'
  }
}

export const ACCEPT_ATTR = '.stl,.obj,.3mf,.step,.stp'

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

/** Why the intake turned a file away — carries the name so copy can quote it. */
export interface IntakeRejection {
  reason: 'type' | 'size'
  fileName: string
}

/**
 * Split a drop/pick into what the intake will forward and what it won't.
 *
 * `useParts.handleFiles` runs the same checks and toasts on failure, but a
 * toast is transient and leaves no state — the tabbed intake needs the reason
 * on screen (design 4b-05). Pure, so it can also be unit-tested; running it
 * first is a harmless double check, never the only one.
 */
export function partitionFiles(files: File[]): {
  accepted: File[]
  rejected: IntakeRejection[]
} {
  const accepted: File[] = []
  const rejected: IntakeRejection[] = []
  for (const file of files) {
    if (classifyFile(file.name) === 'unsupported') {
      rejected.push({ reason: 'type', fileName: file.name })
    } else if (file.size > MAX_FILE_BYTES) {
      rejected.push({ reason: 'size', fileName: file.name })
    } else {
      accepted.push(file)
    }
  }
  return { accepted, rejected }
}

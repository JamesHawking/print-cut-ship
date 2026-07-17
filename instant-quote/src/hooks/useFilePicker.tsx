import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useParts } from '@/hooks/useParts'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n'
import { ACCEPT_ATTR } from '@/lib/upload'

type OpenFilePicker = () => void

const FilePickerContext = createContext<OpenFilePicker | null>(null)

/**
 * One hidden file input for the whole app: any upload CTA (footer band, demo
 * section, content pages) opens the native picker directly instead of
 * deep-linking to the landing dropzone. The selection enters the same intake
 * pipeline as the dropzone and navigates to /quote — the landing's
 * optimistic-navigation path, available from every page.
 */
export function FilePickerProvider({ children }: { children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { handleFiles } = useParts()
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const locale =
    params.locale && isLocale(params.locale) ? params.locale : DEFAULT_LOCALE

  return (
    <FilePickerContext.Provider value={() => inputRef.current?.click()}>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) {
            void handleFiles(files)
            void navigate({ to: '/$locale/quote', params: { locale } })
          }
          e.target.value = ''
        }}
      />
    </FilePickerContext.Provider>
  )
}

export function useFilePicker(): OpenFilePicker {
  const open = useContext(FilePickerContext)
  if (!open) {
    throw new Error('useFilePicker must be used within FilePickerProvider')
  }
  return open
}

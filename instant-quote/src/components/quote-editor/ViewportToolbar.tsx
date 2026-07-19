import { Focus, Grid3x3, Orbit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { CameraPreset } from '@/lib/camera-presets'
import { useStrings } from '@/lib/i18n'

// The digit badge doubles as the shortcut hint (Blender numpad homage);
// the tooltip carries the full view name. Digits are locale-neutral, so
// check-strings lets them through.
const PRESETS = [
  { preset: 'front', digit: '1' },
  { preset: 'right', digit: '3' },
  { preset: 'top', digit: '7' },
  { preset: 'iso', digit: '0' },
] as const satisfies ReadonlyArray<{
  preset: CameraPreset
  digit: string
}>

interface Props {
  onPreset: (preset: CameraPreset) => void
  onReset: () => void
  gridVisible: boolean
  onToggleGrid: () => void
  autoRotate: boolean
  onToggleAutoRotate: () => void
}

/**
 * Viewport toolbar for the desktop editor: camera presets, frame-part reset,
 * grid-floor and auto-rotate toggles. Centered in the editor top bar.
 */
export function ViewportToolbar({
  onPreset,
  onReset,
  gridVisible,
  onToggleGrid,
  autoRotate,
  onToggleAutoRotate,
}: Props) {
  const strings = useStrings()
  const presetLabel = {
    front: strings.editor.viewFront,
    right: strings.editor.viewRight,
    top: strings.editor.viewTop,
    iso: strings.editor.viewIso,
  } as const

  return (
    <TooltipProvider>
      <div className="bg-card flex items-center gap-0.5 rounded-md border p-0.5 shadow-sm">
        {PRESETS.map(({ preset, digit }) => (
          <Tooltip key={preset}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 font-mono text-[0.65rem] font-bold"
                onClick={() => onPreset(preset)}
              >
                {digit}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {presetLabel[preset]} · {digit}
            </TooltipContent>
          </Tooltip>
        ))}
        <div aria-hidden className="bg-border mx-0.5 h-4 w-px" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onReset}
            >
              <Focus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{strings.editor.resetView} · R</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={gridVisible}
              className={cn('size-7', gridVisible && 'bg-secondary')}
              onClick={onToggleGrid}
            >
              <Grid3x3 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{strings.editor.grid} · G</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={autoRotate}
              className={cn('size-7', autoRotate && 'bg-secondary')}
              onClick={onToggleAutoRotate}
            >
              <Orbit className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{strings.editor.autoRotate} · A</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

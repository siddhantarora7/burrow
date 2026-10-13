'use client'
import { BurrowScreen } from '@/components/BurrowView'
import { useDemoBurrow } from '@/lib/demoBurrow'

export function DemoGarden({ count, embed = false }: { count: number; embed?: boolean }) {
  return <BurrowScreen {...useDemoBurrow(count)} label="demo garden" statusLabel="demo" embed={embed} />
}

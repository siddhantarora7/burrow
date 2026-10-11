'use client'
import { BurrowScreen } from '@/components/BurrowView'
import { useDemoBurrow } from '@/lib/demoBurrow'

export function DemoGarden({ count }: { count: number }) {
  return <BurrowScreen {...useDemoBurrow(count)} label="demo garden, synthetic pets" />
}

'use client'
import { BurrowScreen } from '@/components/BurrowView'
import { useDemoBurrow } from '@/lib/demoBurrow'

/** The front door is the product: a demo garden, labelled as one, under the headline. */
export function Landing() {
  return <BurrowScreen {...useDemoBurrow(5)} label="demo garden, synthetic pets" statusLabel="demo" hero />
}

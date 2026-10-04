import { notFound } from 'next/navigation'
import { isId } from '@burrow/core'
import { BurrowView } from '@/components/BurrowView'

export default async function BurrowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isId(id)) notFound()
  return <BurrowView id={id} />
}

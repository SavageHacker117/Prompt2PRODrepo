import React, { useMemo } from 'react'
import { getLevel } from '../levels/index.js'

export default function LevelLoader({ level, children }) {
  const config = useMemo(() => getLevel(level), [level])
  return children(config)
}

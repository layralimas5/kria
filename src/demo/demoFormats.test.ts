import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatSchema } from '../domain/formats'
import { DEMO_FORMATS } from './demoFormats'

const migration = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/0015_formats.sql'), 'utf8')

describe('formatos do demo', () => {
  it('passam pelo schema do app', () => {
    for (const format of DEMO_FORMATS) expect(formatSchema.safeParse(format).success).toBe(true)
  })

  it('são os mesmos da migration, com as mesmas opções', () => {
    for (const format of DEMO_FORMATS.map((row) => formatSchema.parse(row))) {
      expect(migration).toContain(`('${format.slug}', '${format.name}', '${format.niche}'`)
      for (const field of format.fields) {
        expect(migration).toContain(`"key": "${field.key}", "label": "${field.label}"`)
        for (const choice of field.choices) expect(migration).toContain(`{"value": "${choice.value}", "label": "${choice.label}"`)
      }
    }
  })
})

// Regras puras dos formatos (0015): sem rede, sem Deno. Testadas em formats.test.ts.
// O prompt sai do modelo do formato; da pessoa só entram escolhas da lista e um detalhe curto.

import { checkPrompt } from './generation.ts'

export interface FormatChoice {
  readonly value: string
  readonly label: string
  readonly prompt: string
}

export interface FormatField {
  readonly key: string
  readonly label: string
  readonly choices: readonly FormatChoice[]
}

export type FormatFlow = 'single' | 'before_after'
/** `edit`: a foto editada do antes e depois. `final`: o resultado do formato. */
export type FormatStep = 'edit' | 'final'

export interface FormatRow {
  readonly slug: string
  readonly flow: FormatFlow
  readonly model_slug: string
  readonly prompt_template: string
  readonly edit_model_slug: string | null
  readonly edit_prompt_template: string | null
  readonly fields: readonly FormatField[]
}

export const NOTE_MAX = 200

export type FormatPlan =
  | { readonly ok: true; readonly model: string; readonly prompt: string }
  | { readonly ok: false; readonly reason: string }

function isChoice(value: unknown): value is FormatChoice {
  const choice = value as Partial<FormatChoice> | null
  return typeof choice?.value === 'string' && typeof choice.label === 'string' && typeof choice.prompt === 'string'
}

/** Lê `formats.fields` do banco; campo malformado é descartado em vez de quebrar o pedido. */
export function parseFormatFields(raw: unknown): FormatField[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const field = item as Partial<FormatField> | null
    if (typeof field?.key !== 'string' || typeof field.label !== 'string' || !Array.isArray(field.choices)) return []
    const choices = field.choices.filter(isChoice)
    return choices.length > 0 ? [{ key: field.key, label: field.label, choices }] : []
  })
}

/** Troca cada {key} pelo texto da escolha; o que não foi escolhido usa a primeira opção. */
function fill(template: string, fields: readonly FormatField[], picked: Readonly<Record<string, string>>): string {
  return fields.reduce((text, field) => {
    const choice = field.choices.find((item) => item.value === picked[field.key]) ?? field.choices[0]!
    return text.replaceAll(`{${field.key}}`, choice.prompt)
  }, template)
}

/** Decide modelo e prompt de uma etapa do formato, recusando escolha fora da lista. */
export function planFormatStep(
  format: FormatRow,
  step: FormatStep,
  picked: Readonly<Record<string, string>>,
  note = '',
): FormatPlan {
  for (const [key, value] of Object.entries(picked)) {
    const field = format.fields.find((item) => item.key === key)
    if (!field) return { ok: false, reason: 'Esse formato não tem essa opção.' }
    if (!field.choices.some((choice) => choice.value === value)) return { ok: false, reason: 'Opção não aceita por esse formato.' }
  }

  const detail = note.trim()
  if (detail.length > NOTE_MAX) return { ok: false, reason: `O detalhe passa de ${NOTE_MAX} caracteres.` }
  if (detail) {
    const check = checkPrompt(detail)
    if (!check.ok) return check
  }

  const isEdit = step === 'edit'
  if (isEdit && (format.flow !== 'before_after' || !format.edit_model_slug || !format.edit_prompt_template)) {
    return { ok: false, reason: 'Esse formato não tem etapa de edição.' }
  }
  const template = isEdit ? format.edit_prompt_template! : format.prompt_template
  const base = fill(template, format.fields, picked)
  return {
    ok: true,
    model: isEdit ? format.edit_model_slug! : format.model_slug,
    prompt: detail ? `${base} Details: ${detail}` : base,
  }
}

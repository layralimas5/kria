import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'

interface PixPayerFormProps {
  readonly onSubmit: (payer: { name: string; cpf: string }) => void
  readonly onBack: () => void
}

/** 000.000.000-00 enquanto a pessoa digita; o servidor recebe só os números e confere os dígitos. */
function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

/** O Asaas exige nome e CPF para a cobrança Pix mensal. */
export function PixPayerForm({ onSubmit, onBack }: PixPayerFormProps) {
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const ready = name.trim().length >= 3 && cpf.replace(/\D/g, '').length === 11

  function submit(event: FormEvent) {
    event.preventDefault()
    if (ready) onSubmit({ name: name.trim(), cpf: cpf.replace(/\D/g, '') })
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <TextField
        label="Nome completo"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
        required
      />
      <TextField
        label="CPF"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        value={cpf}
        onChange={(event) => setCpf(formatCpf(event.target.value))}
        hint="Vai só para o Asaas emitir a cobrança. O Vynkio não guarda."
        required
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button type="submit" disabled={!ready} className="flex-1">
          Gerar Pix
        </Button>
      </div>
    </form>
  )
}

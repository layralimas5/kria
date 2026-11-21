import { Link } from 'react-router-dom'

/** Rodapé da loja: quem processa o pagamento e os termos. */
export function StoreFooter() {
  return (
    <footer className="mx-auto max-w-[640px] px-4 pb-10 pt-2 text-center text-xs leading-relaxed text-zinc-500">
      <p>Pagamento processado pelo Asaas. O Vynkio não guarda os dados do seu cartão.</p>
      <p className="mt-1">
        Vynkio © {new Date().getFullYear()} ·{' '}
        <Link to="/termos" className="underline underline-offset-2 hover:text-zinc-700">
          Termos de uso
        </Link>
      </p>
    </footer>
  )
}

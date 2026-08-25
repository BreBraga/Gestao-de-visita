# PWA de Gestão de Visitas — Fatia 1: o vendedor consegue trabalhar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um PWA instalável onde o vendedor entra com senha, vê o kanban de visitas do Zaple no celular, cria visita vinculada a um contato, e move o card entre as quatro etapas — substituindo o Zaple no celular.

**Architecture:** Next.js (App Router) na Vercel, um único deploy. O token do Zaple existe apenas no servidor. Todo acesso à API do Zaple passa por `lib/zaple/`, que expõe verbos do domínio e concentra retry, paginação e a montagem do array `fields` do PUT v3. O login fica atrás da interface de `lib/auth/` para que a troca por OTP no futuro não toque nas telas. Postgres (Neon) guarda apenas os usuários nesta fatia.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM + `@neondatabase/serverless` · zod · jose (sessão JWT) · bcryptjs · Vitest · dnd-kit (drag no desktop)

**Spec:** [`docs/superpowers/specs/2026-08-24-pwa-gestao-visitas-design.md`](../specs/2026-08-24-pwa-gestao-visitas-design.md)

**Escopo desta fatia:** seções 3, 4.2 (`usuario`), 5.3, 6 (kanban, detalhe, nova visita) e 9 do spec.
**Fora desta fatia:** checklist, relatório, rascunho/fila offline, `visita_resposta`, dashboard e export — Fatias 2 e 3, cada uma com seu plano.

---

## Global Constraints

- **Node 20+**, Next.js 15 App Router, TypeScript em modo `strict`.
- **O token do Zaple nunca chega ao navegador.** Nenhum `NEXT_PUBLIC_` carrega credencial; nenhuma resposta de API nossa devolve o token; nenhum `console.log` imprime headers de requisição ao Zaple.
- **Base da API do Zaple:** `https://api.wts.chat`. CRM em `/crm`, resto em `/core`.
- **Painel alvo:** `fd605396-cc03-4e8a-bf7d-aa2b91594cf1`.
- **stepIds fixos** (do spec, seção 2):
  - Prospecção `e5b1546c-f374-4d85-a8a2-25e424211c48` (inicial)
  - Visita `8d008670-0b2a-4349-9375-716e62b0ef58`
  - RECORRENTE `e76733df-0a6d-441c-bb7b-7c0969f3bd89`
  - Concluído `45a0d42f-612c-43dc-a139-42a13fa22674` (final)
- **Erros do Zaple vêm com HTTP 200 em alguns casos**, sinalizados por `"error": true` no corpo. Detectar pelo corpo, nunca só pelo status.
- **`PUT /crm/v3/panel/card/{id}` exige o array `fields`** listando o que está sendo alterado. Campo enviado sem estar declarado em `fields` é ignorado silenciosamente.
- **`PageSize` máximo é 100.**
- **Telefone no Zaple é armazenado como `+55|21977237528`** (com pipe). A busca por telefone usa o formato sem pipe e sem `+`: `5521977237528`.
- **Idioma do código:** identificadores de domínio em português (`Visita`, `listarVisitas`, `moverEtapa`), pois é o vocabulário do cliente. Termos técnicos permanecem em inglês.
- **Toda visita precisa de responsável e de pelo menos um contato.** Validação nossa — a API do Zaple aceita card órfão.

### Variáveis de ambiente

```
ZAPLE_TOKEN=pn_...                                   # token de painel, server-side
ZAPLE_BASE_URL=https://api.wts.chat
ZAPLE_PANEL_ID=fd605396-cc03-4e8a-bf7d-aa2b91594cf1
DATABASE_URL=postgres://...                          # Neon
SESSION_SECRET=...                                   # 32+ bytes aleatórios
```

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/zaple/client.ts` | fetch autenticado, retry, detecção de erro, paginação |
| `src/lib/zaple/erros.ts` | `ZapleError` e classificação de erro |
| `src/lib/zaple/painel.ts` | etapas do painel |
| `src/lib/zaple/visitas.ts` | listar, obter, criar, atualizar, mover card |
| `src/lib/zaple/contatos.ts` | buscar e criar contato |
| `src/lib/zaple/agentes.ts` | listar agentes |
| `src/lib/zaple/tipos.ts` | tipos do domínio (`Visita`, `Etapa`, `Contato`, `Agente`) |
| `src/lib/db/schema.ts` | tabelas Drizzle |
| `src/lib/db/index.ts` | conexão |
| `src/lib/auth/tipos.ts` | interface `ProvedorLogin` |
| `src/lib/auth/senha.ts` | implementação por senha |
| `src/lib/auth/sessao.ts` | assinar, ler e limpar o cookie de sessão |
| `src/lib/auth/atual.ts` | `usuarioAtual()` para Server Components e rotas |
| `src/app/api/...` | rotas HTTP |
| `src/app/(app)/...` | telas autenticadas |
| `src/app/login/page.tsx` | login |

Regra de fronteira: **nada fora de `src/lib/zaple/` importa `ZAPLE_TOKEN` ou monta URL da API do Zaple.**

---

## Task 1: Esqueleto do projeto e PWA instalável

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `public/manifest.webmanifest`, `public/sw.js`, `public/icone-192.png`, `public/icone-512.png`
- Create: `src/components/RegistrarSW.tsx`
- Test: `tests/manifest.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: projeto executável com `npm run dev`, `npm test`; alias `@/` apontando para `src/`

- [ ] **Step 1: Criar o projeto e o repositório**

```bash
cd "d:/LINKEED HUB/projetos/Gestão de visita"
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm
git init
npm install zod jose bcryptjs drizzle-orm @neondatabase/serverless
npm install -D vitest @vitejs/plugin-react drizzle-kit @types/bcryptjs tsx
```

- [ ] **Step 2: Configurar o Vitest**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

Em `package.json`, acrescentar aos scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Escrever o teste do manifest, que deve falhar**

`tests/manifest.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('manifest do PWA', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf-8'))

  it('declara nome e ponto de partida', () => {
    expect(manifest.name).toBe('Gestão de Visitas')
    expect(manifest.short_name).toBe('Visitas')
    expect(manifest.start_url).toBe('/')
  })

  it('abre como aplicativo, não como aba de navegador', () => {
    expect(manifest.display).toBe('standalone')
  })

  it('tem os dois tamanhos de ícone que o Android exige', () => {
    const tamanhos = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(tamanhos).toContain('192x192')
    expect(tamanhos).toContain('512x512')
  })
})
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `ENOENT: no such file or directory, open 'public/manifest.webmanifest'`

- [ ] **Step 5: Criar o manifest**

`public/manifest.webmanifest`:

```json
{
  "name": "Gestão de Visitas",
  "short_name": "Visitas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0b1220",
  "theme_color": "#0b1220",
  "icons": [
    { "src": "/icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

Gerar `public/icone-192.png` e `public/icone-512.png` (quadrados, fundo `#0b1220`, sigla "V" centralizada em branco).

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — 3 testes

- [ ] **Step 7: Service worker mínimo**

O service worker desta fatia faz apenas cache do casco do app. **Não cacheia resposta de API** — kanban desatualizado exibido como atual é pior do que kanban que não carrega (spec, seção 6).

`public/sw.js`:

```js
const CACHE = 'casco-v1'
const CASCO = ['/', '/manifest.webmanifest', '/icone-192.png', '/icone-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCO)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || Response.error())))
})
```

`src/components/RegistrarSW.tsx`:

```tsx
'use client'
import { useEffect } from 'react'

export function RegistrarSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
```

- [ ] **Step 8: Ligar o manifest e o SW no layout**

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import { RegistrarSW } from '@/components/RegistrarSW'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gestão de Visitas',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Criar `.env.example` e proteger o `.env`**

`.env.example` com as cinco variáveis da seção Global Constraints, todas vazias.
Conferir que `.gitignore` contém `.env*` e não contém `!.env.example` — e acrescentar `!.env.example` para que o exemplo seja versionado.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: esqueleto Next.js com PWA instalável"
```

---

## Task 2: Cliente HTTP do Zaple

**Files:**
- Create: `src/lib/zaple/erros.ts`, `src/lib/zaple/client.ts`
- Test: `tests/zaple/client.test.ts`

**Interfaces:**
- Consumes: `ZAPLE_TOKEN`, `ZAPLE_BASE_URL`
- Produces:
  - `class ZapleError extends Error { key: string; status: number; autorizacao: boolean }`
  - `zapleGet<T>(caminho: string, params?: Record<string, string | string[] | number | undefined>): Promise<T>`
  - `zaplePost<T>(caminho: string, corpo: unknown, params?: …): Promise<T>`
  - `zaplePut<T>(caminho: string, corpo: unknown): Promise<T>`

- [ ] **Step 1: Escrever os testes**

`tests/zaple/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('cliente Zaple', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('envia o token no header e monta a URL', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({ ok: true }))
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await zapleGet('/crm/v2/panel')

    const [url, init] = fetchFalso.mock.calls[0]
    expect(url).toBe('https://api.exemplo/crm/v2/panel')
    expect(init.headers.Authorization).toBe('Bearer pn_teste')
  })

  it('repete parâmetros de array em vez de juntar com vírgula', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({ ok: true }))
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await zapleGet('/crm/v2/panel/card', { IncludeDetails: ['Contacts', 'ResponsibleUser'] })

    expect(fetchFalso.mock.calls[0][0]).toBe(
      'https://api.exemplo/crm/v2/panel/card?IncludeDetails=Contacts&IncludeDetails=ResponsibleUser'
    )
  })

  it('omite parâmetros indefinidos', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({ ok: true }))
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await zapleGet('/crm/v2/panel/card', { PanelId: 'abc', StepId: undefined })

    expect(fetchFalso.mock.calls[0][0]).toBe('https://api.exemplo/crm/v2/panel/card?PanelId=abc')
  })

  it('trata erro sinalizado no corpo mesmo com HTTP 200', async () => {
    // Formato real observado em 2026-08-24 contra a API de produção.
    const fetchFalso = vi.fn().mockResolvedValue(
      respostaJson({
        httpStatusCode: 404,
        error: true,
        key: 'ERROR_UNAUTHORIZED',
        text: 'Acesso negado',
      })
    )
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')
    const { ZapleError } = await import('@/lib/zaple/erros')

    await expect(zapleGet('/core/v1/message')).rejects.toBeInstanceOf(ZapleError)
    await expect(zapleGet('/core/v1/message')).rejects.toMatchObject({
      key: 'ERROR_UNAUTHORIZED',
      autorizacao: true,
    })
  })

  it('não repete a chamada quando o erro é de autorização', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respostaJson({ error: true, key: 'ERROR_UNAUTHORIZED', text: 'Acesso negado' })
    )
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await expect(zapleGet('/core/v1/message')).rejects.toThrow()
    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('repete a chamada em erro 5xx e devolve o sucesso', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respostaJson({ error: true, key: 'INTERNAL' }, 500))
      .mockResolvedValueOnce(respostaJson({ id: 'ok' }))
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    const r = await zapleGet<{ id: string }>('/crm/v2/panel')

    expect(r.id).toBe('ok')
    expect(fetchFalso).toHaveBeenCalledTimes(2)
  })

  it('desiste após o teto de tentativas', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson({ error: true, key: 'INTERNAL' }, 500))
    vi.stubGlobal('fetch', fetchFalso)
    const { zapleGet } = await import('@/lib/zaple/client')

    await expect(zapleGet('/crm/v2/panel')).rejects.toThrow()
    expect(fetchFalso).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/zaple/client.test.ts`
Expected: FAIL — `Failed to load @/lib/zaple/client`

- [ ] **Step 3: Implementar os erros**

`src/lib/zaple/erros.ts`:

```ts
export class ZapleError extends Error {
  readonly key: string
  readonly status: number
  /** Erro de permissão do token — repetir a chamada não resolve. */
  readonly autorizacao: boolean

  constructor(key: string, status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ZapleError'
    this.key = key
    this.status = status
    this.autorizacao = key === 'ERROR_UNAUTHORIZED' || status === 401 || status === 403
  }
}

/** Erros transitórios: vale repetir. */
export function vaTentarDeNovo(erro: unknown): boolean {
  if (erro instanceof ZapleError) {
    if (erro.autorizacao) return false
    return erro.status >= 500 || erro.status === 429
  }
  return true // falha de rede
}
```

- [ ] **Step 4: Implementar o cliente**

`src/lib/zaple/client.ts`:

```ts
import { ZapleError, vaTentarDeNovo } from './erros'

const TENTATIVAS = 3
const ESPERA_BASE_MS = 300

type Params = Record<string, string | string[] | number | undefined>

function montarUrl(caminho: string, params?: Params): string {
  const base = process.env.ZAPLE_BASE_URL ?? 'https://api.wts.chat'
  const url = new URL(caminho, base)
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor === undefined) continue
    if (Array.isArray(valor)) {
      for (const v of valor) url.searchParams.append(chave, v)
    } else {
      url.searchParams.append(chave, String(valor))
    }
  }
  return url.toString()
}

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * A API do Zaple sinaliza erro pelo corpo (`error: true`) e às vezes devolve
 * HTTP 200 junto. Confiar só no status deixa passar erro como se fosse dado.
 */
function conferirErro(corpo: unknown, statusHttp: number): void {
  if (corpo && typeof corpo === 'object' && 'error' in corpo && (corpo as { error: unknown }).error === true) {
    const c = corpo as { key?: string; text?: string; httpStatusCode?: number | string }
    const status = typeof c.httpStatusCode === 'number' ? c.httpStatusCode : statusHttp
    throw new ZapleError(c.key ?? 'DESCONHECIDO', status, c.text ?? 'Erro na API do Zaple')
  }
  if (statusHttp >= 400) {
    throw new ZapleError('HTTP_' + statusHttp, statusHttp, `Zaple respondeu ${statusHttp}`)
  }
}

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown, params?: Params): Promise<T> {
  const token = process.env.ZAPLE_TOKEN
  if (!token) throw new Error('ZAPLE_TOKEN não configurado')

  const url = montarUrl(caminho, params)
  let ultimoErro: unknown

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resposta = await fetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
        cache: 'no-store',
      })

      const texto = await resposta.text()
      const dados = texto ? JSON.parse(texto) : null
      conferirErro(dados, resposta.status)
      return dados as T
    } catch (erro) {
      ultimoErro = erro
      if (!vaTentarDeNovo(erro) || tentativa === TENTATIVAS) break
      await esperar(ESPERA_BASE_MS * 2 ** (tentativa - 1))
    }
  }
  throw ultimoErro
}

export const zapleGet = <T>(caminho: string, params?: Params) => requisitar<T>('GET', caminho, undefined, params)
export const zaplePost = <T>(caminho: string, corpo: unknown, params?: Params) => requisitar<T>('POST', caminho, corpo, params)
export const zaplePut = <T>(caminho: string, corpo: unknown) => requisitar<T>('PUT', caminho, corpo)
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/zaple/client.test.ts`
Expected: PASS — 7 testes

- [ ] **Step 6: Commit**

```bash
git add src/lib/zaple tests/zaple
git commit -m "feat(zaple): cliente HTTP com retry e detecção de erro no corpo"
```

---

## Task 3: Tipos do domínio e etapas do painel

**Files:**
- Create: `src/lib/zaple/tipos.ts`, `src/lib/zaple/painel.ts`
- Test: `tests/zaple/painel.test.ts`

**Interfaces:**
- Consumes: `zapleGet` (Task 2)
- Produces:
  - `type Etapa = { id: string; titulo: string; posicao: number; inicial: boolean; final: boolean }`
  - `listarEtapas(): Promise<Etapa[]>` — ordenadas por `posicao`
  - `type Visita`, `type Contato`, `type Agente` (usados nas Tasks 4 e 5)

- [ ] **Step 1: Escrever o teste**

`tests/zaple/painel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Recorte fiel da resposta de GET /crm/v1/panel/{id} capturada em 2026-08-24. */
const PAINEL_REAL = {
  id: 'fd605396-cc03-4e8a-bf7d-aa2b91594cf1',
  title: 'PAINEL DE VISITAS',
  type: 'MANAGEMENT',
  scope: 'DEPARTMENT',
  steps: [
    { id: '8d008670-0b2a-4349-9375-716e62b0ef58', title: 'Visita', position: 2.0, isInitial: false, isFinal: false },
    { id: 'e5b1546c-f374-4d85-a8a2-25e424211c48', title: 'Prospecção', position: 1.0, isInitial: true, isFinal: false },
    { id: '45a0d42f-612c-43dc-a139-42a13fa22674', title: 'Concluído', position: 4.0, isInitial: false, isFinal: true },
    { id: 'e76733df-0a6d-441c-bb7b-7c0969f3bd89', title: 'RECORRENTE', position: 3.0, isInitial: false, isFinal: false },
  ],
}

describe('etapas do painel', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
    process.env.ZAPLE_PANEL_ID = 'fd605396-cc03-4e8a-bf7d-aa2b91594cf1'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('devolve as etapas ordenadas por posição, não pela ordem da API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(PAINEL_REAL), { headers: { 'content-type': 'application/json' } })
    ))
    const { listarEtapas } = await import('@/lib/zaple/painel')

    const etapas = await listarEtapas()

    expect(etapas.map((e) => e.titulo)).toEqual(['Prospecção', 'Visita', 'RECORRENTE', 'Concluído'])
  })

  it('marca a etapa inicial e a final', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(PAINEL_REAL), { headers: { 'content-type': 'application/json' } })
    ))
    const { listarEtapas } = await import('@/lib/zaple/painel')

    const etapas = await listarEtapas()

    expect(etapas[0]).toMatchObject({ titulo: 'Prospecção', inicial: true, final: false })
    expect(etapas[3]).toMatchObject({ titulo: 'Concluído', inicial: false, final: true })
  })

  it('busca o painel configurado no ambiente', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(PAINEL_REAL), { headers: { 'content-type': 'application/json' } })
    )
    vi.stubGlobal('fetch', fetchFalso)
    const { listarEtapas } = await import('@/lib/zaple/painel')

    await listarEtapas()

    expect(fetchFalso.mock.calls[0][0]).toContain('/crm/v1/panel/fd605396-cc03-4e8a-bf7d-aa2b91594cf1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/zaple/painel.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Escrever os tipos do domínio**

`src/lib/zaple/tipos.ts`:

```ts
export type Etapa = {
  id: string
  titulo: string
  posicao: number
  inicial: boolean
  final: boolean
}

export type ContatoResumo = {
  id: string
  nome: string
}

export type Visita = {
  id: string
  chave: string // "PDV-1"
  numero: number
  titulo: string
  descricao: string | null
  etapaId: string
  etapaTitulo: string | null
  posicao: number
  prazo: string | null // ISO 8601
  atrasada: boolean
  responsavelId: string | null
  responsavelNome: string | null
  contatos: ContatoResumo[]
  metadata: Record<string, string> | null
  criadaEm: string
  atualizadaEm: string
}

export type Contato = {
  id: string
  nome: string
  telefone: string | null // formato de exibição: (21) 97723-7528
  email: string | null
}

export type Agente = {
  id: string
  nome: string
  email: string | null
}

export type Pagina<T> = {
  itens: T[]
  total: number
  temMais: boolean
}
```

- [ ] **Step 4: Implementar `listarEtapas`**

`src/lib/zaple/painel.ts`:

```ts
import { zapleGet } from './client'
import type { Etapa } from './tipos'

type EtapaApi = {
  id: string
  title: string
  position: number
  isInitial: boolean
  isFinal: boolean
}

type PainelApi = {
  id: string
  title: string
  steps: EtapaApi[] | null
}

export function painelId(): string {
  const id = process.env.ZAPLE_PANEL_ID
  if (!id) throw new Error('ZAPLE_PANEL_ID não configurado')
  return id
}

export async function listarEtapas(): Promise<Etapa[]> {
  const painel = await zapleGet<PainelApi>(`/crm/v1/panel/${painelId()}`)
  const etapas = painel.steps ?? []
  return etapas
    .map((e) => ({
      id: e.id,
      titulo: e.title,
      posicao: e.position,
      inicial: e.isInitial,
      final: e.isFinal,
    }))
    .sort((a, b) => a.posicao - b.posicao)
}
```

> Nota para quem implementa: `GET /crm/v1/panel/{id}` devolveu `steps: null` no teste ao vivo de 2026-08-24, enquanto `GET /crm/v2/panel?IncludeDetails=Steps` devolveu as etapas preenchidas. Rode `npx tsx scripts/conferir-etapas.ts` (Step 5) contra a API real antes de seguir: se `steps` vier `null`, troque a implementação para `zapleGet('/crm/v2/panel', { IncludeDetails: 'Steps', PageSize: 100 })` e encontre o painel por `id`. Os testes acima continuam válidos nos dois casos, porque testam o contrato de saída.

- [ ] **Step 5: Conferir contra a API real**

`scripts/conferir-etapas.ts`:

```ts
import { listarEtapas } from '@/lib/zaple/painel'

const etapas = await listarEtapas()
console.table(etapas)
if (etapas.length !== 4) {
  console.error('ESPERADO 4 etapas, veio', etapas.length, '— ajuste painel.ts conforme a nota do plano')
  process.exit(1)
}
```

Run: `npx tsx --env-file=.env scripts/conferir-etapas.ts`
Expected: tabela com Prospecção, Visita, RECORRENTE, Concluído

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/zaple/painel.test.ts`
Expected: PASS — 3 testes

- [ ] **Step 7: Commit**

```bash
git add src/lib/zaple tests/zaple scripts
git commit -m "feat(zaple): tipos do domínio e etapas do painel"
```

---

## Task 4: Cards de visita — listar, obter, criar, mover

**Files:**
- Create: `src/lib/zaple/visitas.ts`
- Test: `tests/zaple/visitas.test.ts`

**Interfaces:**
- Consumes: `zapleGet`, `zaplePost`, `zaplePut` (Task 2); `Visita`, `Pagina` (Task 3); `painelId()` (Task 3)
- Produces:
  - `listarVisitas(filtro: FiltroVisitas): Promise<Pagina<Visita>>`
  - `obterVisita(id: string): Promise<Visita>`
  - `criarVisita(entrada: NovaVisita): Promise<Visita>`
  - `atualizarVisita(id: string, patch: PatchVisita): Promise<Visita>`
  - `moverEtapa(id: string, etapaId: string): Promise<Visita>`
  - `type FiltroVisitas = { etapaId?: string; responsavelId?: string; busca?: string; pagina?: number; tamanho?: number }`
  - `type NovaVisita = { etapaId: string; titulo: string; responsavelId: string; contatoIds: string[]; prazo?: string; descricao?: string }`
  - `type PatchVisita = Partial<{ etapaId: string; titulo: string; descricao: string; prazo: string | null; responsavelId: string; contatoIds: string[]; posicao: number; metadata: Record<string, string> }>`

- [ ] **Step 1: Escrever os testes**

`tests/zaple/visitas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Recorte fiel de GET /crm/v2/panel/card capturado em 2026-08-24. */
const CARD_REAL = {
  status: 'OPEN',
  id: '3c297d05-eca5-4522-8b19-6c0656b750f4',
  createdAt: '2026-08-24T12:45:57.590904Z',
  updatedAt: '2026-08-24T14:57:41.009257Z',
  panelId: 'fd605396-cc03-4e8a-bf7d-aa2b91594cf1',
  stepId: '8d008670-0b2a-4349-9375-716e62b0ef58',
  stepTitle: 'Visita',
  position: 0.25,
  title: 'Padaria do Zé',
  description: null,
  key: 'PDV-1',
  number: 1,
  dueDate: null,
  isOverdue: false,
  monetaryAmount: 500.0,
  responsibleUserId: null,
  responsibleUser: null,
  contactIds: [],
  contacts: [],
  customFields: null,
  metadata: null,
}

const PAGINA_REAL = { items: [CARD_REAL], totalItems: 1, totalPages: 1, hasMorePages: false, pageNumber: 1, pageSize: 15 }

function stub(corpo: unknown) {
  const f = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(corpo), { headers: { 'content-type': 'application/json' } })
  )
  vi.stubGlobal('fetch', f)
  return f
}

describe('visitas', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
    process.env.ZAPLE_PANEL_ID = 'fd605396-cc03-4e8a-bf7d-aa2b91594cf1'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('converte o card da API para o formato do domínio', async () => {
    stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    const { itens, total, temMais } = await listarVisitas({})

    expect(total).toBe(1)
    expect(temMais).toBe(false)
    expect(itens[0]).toMatchObject({
      id: '3c297d05-eca5-4522-8b19-6c0656b750f4',
      chave: 'PDV-1',
      numero: 1,
      titulo: 'Padaria do Zé',
      etapaId: '8d008670-0b2a-4349-9375-716e62b0ef58',
      etapaTitulo: 'Visita',
      prazo: null,
      atrasada: false,
      responsavelId: null,
      contatos: [],
    })
  })

  it('sempre pede os detalhes que a tela precisa', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({})

    const url = f.mock.calls[0][0] as string
    expect(url).toContain('IncludeDetails=StepTitle')
    expect(url).toContain('IncludeDetails=ResponsibleUser')
    expect(url).toContain('IncludeDetails=Contacts')
    expect(url).toContain('PanelId=fd605396-cc03-4e8a-bf7d-aa2b91594cf1')
  })

  it('filtra por responsável e por etapa', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({ responsavelId: 'agente-1', etapaId: 'etapa-1', busca: 'padaria' })

    const url = f.mock.calls[0][0] as string
    expect(url).toContain('ResponsibleUserId=agente-1')
    expect(url).toContain('StepId=etapa-1')
    expect(url).toContain('TextFilter=padaria')
  })

  it('limita o tamanho de página ao máximo aceito pela API', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({ tamanho: 500 })

    expect(f.mock.calls[0][0]).toContain('PageSize=100')
  })

  it('só busca visitas abertas, não arquivadas', async () => {
    const f = stub(PAGINA_REAL)
    const { listarVisitas } = await import('@/lib/zaple/visitas')

    await listarVisitas({})

    expect(f.mock.calls[0][0]).toContain('Statuses=OPEN')
  })

  it('cria a visita com etapa, título, responsável e contatos', async () => {
    const f = stub(CARD_REAL)
    const { criarVisita } = await import('@/lib/zaple/visitas')

    await criarVisita({
      etapaId: 'e5b1546c-f374-4d85-a8a2-25e424211c48',
      titulo: 'Padaria do Zé',
      responsavelId: 'agente-1',
      contatoIds: ['contato-1'],
      prazo: '2026-09-01T13:00:00Z',
    })

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo).toEqual({
      stepId: 'e5b1546c-f374-4d85-a8a2-25e424211c48',
      title: 'Padaria do Zé',
      responsibleUserId: 'agente-1',
      contactIds: ['contato-1'],
      dueDate: '2026-09-01T13:00:00Z',
    })
  })

  it('recusa criar visita sem responsável ou sem contato', async () => {
    stub(CARD_REAL)
    const { criarVisita } = await import('@/lib/zaple/visitas')

    await expect(
      criarVisita({ etapaId: 'etapa-1', titulo: 'X', responsavelId: '', contatoIds: ['c1'] })
    ).rejects.toThrow('responsável')

    await expect(
      criarVisita({ etapaId: 'etapa-1', titulo: 'X', responsavelId: 'a1', contatoIds: [] })
    ).rejects.toThrow('contato')
  })

  it('declara em fields exatamente o que está alterando', async () => {
    const f = stub(CARD_REAL)
    const { atualizarVisita } = await import('@/lib/zaple/visitas')

    await atualizarVisita('card-1', { etapaId: 'etapa-2', prazo: '2026-09-10T12:00:00Z' })

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo.fields.sort()).toEqual(['DueDate', 'StepId'])
    expect(corpo.stepId).toBe('etapa-2')
    expect(corpo.dueDate).toBe('2026-09-10T12:00:00Z')
    expect(f.mock.calls[0][1].method).toBe('PUT')
    expect(f.mock.calls[0][0]).toContain('/crm/v3/panel/card/card-1')
  })

  it('permite limpar o prazo enviando null com o campo declarado', async () => {
    const f = stub(CARD_REAL)
    const { atualizarVisita } = await import('@/lib/zaple/visitas')

    await atualizarVisita('card-1', { prazo: null })

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo.fields).toEqual(['DueDate'])
    expect(corpo.dueDate).toBeNull()
  })

  it('recusa atualização vazia em vez de enviar requisição inútil', async () => {
    const f = stub(CARD_REAL)
    const { atualizarVisita } = await import('@/lib/zaple/visitas')

    await expect(atualizarVisita('card-1', {})).rejects.toThrow('nada para atualizar')
    expect(f).not.toHaveBeenCalled()
  })

  it('mover etapa é uma atualização só do StepId', async () => {
    const f = stub(CARD_REAL)
    const { moverEtapa } = await import('@/lib/zaple/visitas')

    await moverEtapa('card-1', 'etapa-3')

    const corpo = JSON.parse(f.mock.calls[0][1].body)
    expect(corpo.fields).toEqual(['StepId'])
    expect(corpo.stepId).toBe('etapa-3')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/zaple/visitas.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`src/lib/zaple/visitas.ts`:

```ts
import { zapleGet, zaplePost, zaplePut } from './client'
import { painelId } from './painel'
import type { Pagina, Visita } from './tipos'

const TAMANHO_MAXIMO = 100
const DETALHES = ['StepTitle', 'ResponsibleUser', 'Contacts']

type CardApi = {
  id: string
  key: string
  number: number
  title: string
  description: string | null
  stepId: string
  stepTitle: string | null
  position: number
  dueDate: string | null
  isOverdue: boolean
  responsibleUserId: string | null
  responsibleUser: { id: string; name: string } | null
  contacts: { id: string; name: string }[] | null
  contactIds: string[] | null
  metadata: Record<string, string> | null
  createdAt: string
  updatedAt: string
}

type PaginaApi<T> = {
  items: T[]
  totalItems: number
  hasMorePages: boolean
}

function paraVisita(c: CardApi): Visita {
  return {
    id: c.id,
    chave: c.key,
    numero: c.number,
    titulo: c.title,
    descricao: c.description,
    etapaId: c.stepId,
    etapaTitulo: c.stepTitle,
    posicao: c.position,
    prazo: c.dueDate,
    atrasada: c.isOverdue,
    responsavelId: c.responsibleUserId,
    responsavelNome: c.responsibleUser?.name ?? null,
    contatos: (c.contacts ?? []).map((k) => ({ id: k.id, nome: k.name })),
    metadata: c.metadata,
    criadaEm: c.createdAt,
    atualizadaEm: c.updatedAt,
  }
}

export type FiltroVisitas = {
  etapaId?: string
  responsavelId?: string
  busca?: string
  pagina?: number
  tamanho?: number
}

export async function listarVisitas(filtro: FiltroVisitas): Promise<Pagina<Visita>> {
  const pagina = await zapleGet<PaginaApi<CardApi>>('/crm/v2/panel/card', {
    PanelId: painelId(),
    StepId: filtro.etapaId,
    ResponsibleUserId: filtro.responsavelId,
    TextFilter: filtro.busca,
    Statuses: 'OPEN',
    IncludeDetails: DETALHES,
    PageNumber: filtro.pagina ?? 1,
    PageSize: Math.min(filtro.tamanho ?? TAMANHO_MAXIMO, TAMANHO_MAXIMO),
    OrderBy: 'Position',
    OrderDirection: 'ASCENDING',
  })

  return {
    itens: pagina.items.map(paraVisita),
    total: pagina.totalItems,
    temMais: pagina.hasMorePages,
  }
}

export async function obterVisita(id: string): Promise<Visita> {
  const card = await zapleGet<CardApi>(`/crm/v2/panel/card/${id}`, { IncludeDetails: DETALHES })
  return paraVisita(card)
}

export type NovaVisita = {
  etapaId: string
  titulo: string
  responsavelId: string
  contatoIds: string[]
  prazo?: string
  descricao?: string
}

export async function criarVisita(entrada: NovaVisita): Promise<Visita> {
  // Regra nossa: a API do Zaple aceita card órfão, mas card órfão é invisível
  // para o vendedor e incontável para o gestor (spec, seção 5.3).
  if (!entrada.responsavelId) throw new Error('Visita precisa de um responsável')
  if (entrada.contatoIds.length === 0) throw new Error('Visita precisa de ao menos um contato')

  const card = await zaplePost<CardApi>('/crm/v2/panel/card', {
    stepId: entrada.etapaId,
    title: entrada.titulo,
    responsibleUserId: entrada.responsavelId,
    contactIds: entrada.contatoIds,
    ...(entrada.prazo ? { dueDate: entrada.prazo } : {}),
    ...(entrada.descricao ? { description: entrada.descricao } : {}),
  })
  return paraVisita(card)
}

export type PatchVisita = Partial<{
  etapaId: string
  titulo: string
  descricao: string
  prazo: string | null
  responsavelId: string
  contatoIds: string[]
  posicao: number
  metadata: Record<string, string>
}>

/**
 * O PUT v3 do Zaple ignora silenciosamente qualquer campo que não esteja
 * declarado em `fields`. Este mapa é a única fonte dessa correspondência.
 */
const CAMPOS: Record<keyof PatchVisita, { field: string; chave: string }> = {
  etapaId: { field: 'StepId', chave: 'stepId' },
  titulo: { field: 'Title', chave: 'title' },
  descricao: { field: 'Description', chave: 'description' },
  prazo: { field: 'DueDate', chave: 'dueDate' },
  responsavelId: { field: 'ResponsibleUserId', chave: 'responsibleUserId' },
  contatoIds: { field: 'ContactIds', chave: 'contactIds' },
  posicao: { field: 'Position', chave: 'position' },
  metadata: { field: 'Metadata', chave: 'metadata' },
}

export async function atualizarVisita(id: string, patch: PatchVisita): Promise<Visita> {
  const fields: string[] = []
  const corpo: Record<string, unknown> = {}

  for (const [nome, valor] of Object.entries(patch) as [keyof PatchVisita, unknown][]) {
    if (valor === undefined) continue
    const mapa = CAMPOS[nome]
    fields.push(mapa.field)
    corpo[mapa.chave] = valor
  }

  if (fields.length === 0) throw new Error('nada para atualizar')

  const card = await zaplePut<CardApi>(`/crm/v3/panel/card/${id}`, { fields, ...corpo })
  return paraVisita(card)
}

export function moverEtapa(id: string, etapaId: string): Promise<Visita> {
  return atualizarVisita(id, { etapaId })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/zaple/visitas.test.ts`
Expected: PASS — 11 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/zaple/visitas.ts tests/zaple/visitas.test.ts
git commit -m "feat(zaple): CRUD de visitas com fields explícitos no PUT v3"
```

---

## Task 5: Contatos e agentes

**Files:**
- Create: `src/lib/zaple/contatos.ts`, `src/lib/zaple/agentes.ts`
- Test: `tests/zaple/contatos.test.ts`, `tests/zaple/agentes.test.ts`

**Interfaces:**
- Consumes: `zapleGet`, `zaplePost` (Task 2); `Contato`, `Agente` (Task 3)
- Produces:
  - `buscarContatosPorNome(nome: string, limite?: number): Promise<Contato[]>`
  - `buscarContatoPorTelefone(telefone: string): Promise<Contato | null>`
  - `criarContato(entrada: { nome: string; telefone: string }): Promise<Contato>`
  - `normalizarTelefone(bruto: string): string` — dígitos com DDI, ex.: `5521977237528`
  - `listarAgentes(): Promise<Agente[]>`

- [ ] **Step 1: Escrever os testes de contato**

`tests/zaple/contatos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Recorte fiel de GET /core/v1/contact capturado em 2026-08-24. */
const CONTATO_REAL = {
  id: 'c9b9a216-9707-4c45-acca-15fec0486051',
  name: 'VITOR HUGO',
  phoneNumber: '+55|21977237528',
  phoneNumberFormatted: '(21) 97723-7528',
  email: 'supervisao.vendas@altaperformancerj.com.br',
  status: 'ACTIVE',
}

function stub(corpo: unknown, status = 200) {
  const f = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
  )
  vi.stubGlobal('fetch', f)
  return f
}

describe('normalizarTelefone', () => {
  beforeEach(() => vi.resetModules())

  it('tira máscara e acrescenta o DDI do Brasil', async () => {
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('(21) 97723-7528')).toBe('5521977237528')
  })

  it('não duplica o DDI quando já vem informado', async () => {
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('+55 21 97723-7528')).toBe('5521977237528')
    expect(normalizarTelefone('5521977237528')).toBe('5521977237528')
  })

  it('entende o formato com pipe que o Zaple armazena', async () => {
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('+55|21977237528')).toBe('5521977237528')
  })

  it('não confunde o DDD 55 do Rio Grande do Sul com o DDI', async () => {
    // (55) 99988-7766 tem 11 dígitos e começa com "55". Se a regra olhasse só
    // o prefixo, o número sairia sem DDI e o contato nunca seria encontrado.
    const { normalizarTelefone } = await import('@/lib/zaple/contatos')
    expect(normalizarTelefone('(55) 99988-7766')).toBe('5555999887766')
  })
})

describe('contatos', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('busca por nome usando o endpoint de filtro, que é POST', async () => {
    const f = stub({ items: [CONTATO_REAL], totalItems: 1, hasMorePages: false })
    const { buscarContatosPorNome } = await import('@/lib/zaple/contatos')

    const achados = await buscarContatosPorNome('VITOR')

    expect(f.mock.calls[0][0]).toContain('/core/v1/contact/filter')
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ name: 'VITOR' })
    expect(achados[0]).toEqual({
      id: 'c9b9a216-9707-4c45-acca-15fec0486051',
      nome: 'VITOR HUGO',
      telefone: '(21) 97723-7528',
      email: 'supervisao.vendas@altaperformancerj.com.br',
    })
  })

  it('busca por telefone normalizando antes de montar a URL', async () => {
    const f = stub(CONTATO_REAL)
    const { buscarContatoPorTelefone } = await import('@/lib/zaple/contatos')

    const achado = await buscarContatoPorTelefone('(21) 97723-7528')

    expect(f.mock.calls[0][0]).toContain('/core/v1/contact/phoneNumber/5521977237528')
    expect(achado?.nome).toBe('VITOR HUGO')
  })

  it('devolve null quando o telefone não existe, em vez de estourar', async () => {
    stub({ error: true, key: 'NOT_FOUND', text: 'Contato não encontrado', httpStatusCode: 404 })
    const { buscarContatoPorTelefone } = await import('@/lib/zaple/contatos')

    expect(await buscarContatoPorTelefone('21999999999')).toBeNull()
  })

  it('propaga erro de autorização em vez de escondê-lo como null', async () => {
    stub({ error: true, key: 'ERROR_UNAUTHORIZED', text: 'Acesso negado' })
    const { buscarContatoPorTelefone } = await import('@/lib/zaple/contatos')

    await expect(buscarContatoPorTelefone('21999999999')).rejects.toThrow('Acesso negado')
  })

  it('cria contato com o telefone normalizado', async () => {
    const f = stub(CONTATO_REAL)
    const { criarContato } = await import('@/lib/zaple/contatos')

    await criarContato({ nome: 'Padaria do Zé', telefone: '(21) 98888-7777' })

    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      name: 'Padaria do Zé',
      phoneNumber: '5521988887777',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/zaple/contatos.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar contatos**

`src/lib/zaple/contatos.ts`:

```ts
import { zapleGet, zaplePost } from './client'
import { ZapleError } from './erros'
import type { Contato } from './tipos'

type ContatoApi = {
  id: string
  name: string
  phoneNumber: string | null
  phoneNumberFormatted: string | null
  email: string | null
}

/**
 * O Zaple armazena telefone como "+55|21977237528" e busca por
 * "5521977237528". Esta função é a única tradução entre os dois mundos.
 */
export function normalizarTelefone(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '')
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos
  return '55' + digitos
}

function paraContato(c: ContatoApi): Contato {
  return {
    id: c.id,
    nome: c.name,
    telefone: c.phoneNumberFormatted ?? c.phoneNumber,
    email: c.email,
  }
}

export async function buscarContatosPorNome(nome: string, limite = 20): Promise<Contato[]> {
  const pagina = await zaplePost<{ items: ContatoApi[] }>(
    '/core/v1/contact/filter',
    { name: nome },
    { PageSize: Math.min(limite, 100) }
  )
  return pagina.items.map(paraContato)
}

export async function buscarContatoPorTelefone(telefone: string): Promise<Contato | null> {
  try {
    const c = await zapleGet<ContatoApi>(`/core/v1/contact/phoneNumber/${normalizarTelefone(telefone)}`)
    return paraContato(c)
  } catch (erro) {
    // "Não existe" é uma resposta válida da busca. "Sem permissão" não é —
    // engolir isso como null esconderia um token quebrado por semanas.
    if (erro instanceof ZapleError && !erro.autorizacao && erro.status === 404) return null
    throw erro
  }
}

export async function criarContato(entrada: { nome: string; telefone: string }): Promise<Contato> {
  const c = await zaplePost<ContatoApi>('/core/v1/contact', {
    name: entrada.nome,
    phoneNumber: normalizarTelefone(entrada.telefone),
  })
  return paraContato(c)
}
```

- [ ] **Step 4: Escrever o teste de agentes**

`tests/zaple/agentes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** GET /core/v1/agent devolve um array cru, não um objeto paginado. */
const AGENTES_REAIS = [
  { id: '79e78c4b-3261-4b82-9010-a471cc005787', name: 'Danilo', email: 'televendas@altaperformancerj.com.br' },
  { id: '42b8cbc0-d047-42b6-ae10-1b5447d8c62e', name: 'Zilda', email: null },
]

describe('agentes', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ZAPLE_TOKEN = 'pn_teste'
    process.env.ZAPLE_BASE_URL = 'https://api.exemplo'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lê o array cru e devolve agentes ordenados por nome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(AGENTES_REAIS), { headers: { 'content-type': 'application/json' } })
    ))
    const { listarAgentes } = await import('@/lib/zaple/agentes')

    const agentes = await listarAgentes()

    expect(agentes.map((a) => a.nome)).toEqual(['Danilo', 'Zilda'])
    expect(agentes[1].email).toBeNull()
  })
})
```

- [ ] **Step 5: Implementar agentes**

`src/lib/zaple/agentes.ts`:

```ts
import { zapleGet } from './client'
import type { Agente } from './tipos'

type AgenteApi = { id: string; name: string; email: string | null }

export async function listarAgentes(): Promise<Agente[]> {
  // Este endpoint devolve um array cru, sem envelope de paginação.
  const agentes = await zapleGet<AgenteApi[]>('/core/v1/agent', { PageSize: 100 })
  return agentes
    .map((a) => ({ id: a.id, nome: a.name, email: a.email }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
```

- [ ] **Step 6: Rodar todos os testes do Zaple**

Run: `npx vitest run tests/zaple`
Expected: PASS — todos

- [ ] **Step 7: Commit**

```bash
git add src/lib/zaple tests/zaple
git commit -m "feat(zaple): busca de contatos e listagem de agentes"
```

---

## Task 6: Banco de dados e tabela de usuários

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `drizzle.config.ts`
- Create: `drizzle/0000_usuario.sql` (gerado)
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL`
- Produces:
  - `usuario` (tabela Drizzle) com colunas `id`, `nome`, `telefone`, `email`, `senhaHash`, `zapleAgentId`, `papel`, `ativo`, `criadoEm`
  - `tentativaLogin` (tabela Drizzle) com `id`, `identificador`, `emJanela` — consumida pelo limitador da Task 8
  - `type Usuario = typeof usuario.$inferSelect`
  - `db` — instância Drizzle

- [ ] **Step 1: Escrever o teste do schema**

Este teste roda sem banco: valida a forma do schema, que é onde erram os enganos caros (papel errado, coluna sem unicidade).

`tests/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { usuario } from '@/lib/db/schema'

describe('tabela usuario', () => {
  const config = getTableConfig(usuario)
  const colunas = Object.fromEntries(config.columns.map((c) => [c.name, c]))

  it('tem as colunas que o login e o kanban precisam', () => {
    for (const nome of ['id', 'nome', 'telefone', 'email', 'senha_hash', 'zaple_agent_id', 'papel', 'ativo', 'criado_em']) {
      expect(colunas[nome], `faltou a coluna ${nome}`).toBeDefined()
    }
  })

  it('exige telefone e vínculo com o agente do Zaple', () => {
    // Sem zaple_agent_id o vendedor não enxerga visita nenhuma (spec, seção 4.2).
    expect(colunas['telefone'].notNull).toBe(true)
    expect(colunas['zaple_agent_id'].notNull).toBe(true)
    expect(colunas['senha_hash'].notNull).toBe(true)
  })

  it('não permite dois usuários com o mesmo telefone', () => {
    expect(colunas['telefone'].isUnique).toBe(true)
  })

  it('nasce ativo e como vendedor', () => {
    expect(colunas['ativo'].hasDefault).toBe(true)
    expect(colunas['papel'].hasDefault).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Escrever o schema**

`src/lib/db/schema.ts`:

```ts
import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const papelEnum = pgEnum('papel', ['vendedor', 'gestor'])

export const usuario = pgTable('usuario', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  /** Normalizado com DDI, sem máscara: 5521977237528. É o identificador de login. */
  telefone: text('telefone').notNull().unique(),
  email: text('email'),
  senhaHash: text('senha_hash').notNull(),
  /** Vínculo com responsibleUserId dos cards. Sem ele o vendedor não vê visita. */
  zapleAgentId: uuid('zaple_agent_id').notNull(),
  papel: papelEnum('papel').notNull().default('vendedor'),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})

export type Usuario = typeof usuario.$inferSelect
export type NovoUsuario = typeof usuario.$inferInsert

/**
 * Tentativas de login, para o limitador da Task 8. Fica no banco e não em
 * memória porque cada requisição na Vercel pode cair numa instância diferente
 * — um contador em memória não limita coisa alguma.
 */
export const tentativaLogin = pgTable('tentativa_login', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Telefone normalizado. Guardamos o alvo, nunca a senha tentada. */
  identificador: text('identificador').notNull(),
  emJanela: timestamp('em_janela', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 4: Conexão e config do Drizzle**

`src/lib/db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL não configurado')

export const db = drizzle(neon(url), { schema })
export * from './schema'
```

`drizzle.config.ts`:

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: PASS — 4 testes

- [ ] **Step 6: Gerar e aplicar a migração**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: `drizzle/0000_*.sql` criado e a tabela `usuario` existente no Neon.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db drizzle drizzle.config.ts tests/db
git commit -m "feat(db): tabela de usuários com vínculo ao agente do Zaple"
```

---

## Task 7: Autenticação por senha e sessão

**Files:**
- Create: `src/lib/auth/tipos.ts`, `src/lib/auth/senha.ts`, `src/lib/auth/sessao.ts`, `src/lib/auth/atual.ts`
- Test: `tests/auth/senha.test.ts`, `tests/auth/sessao.test.ts`

**Interfaces:**
- Consumes: `db`, `usuario`, `Usuario` (Task 6); `normalizarTelefone` (Task 5); `SESSION_SECRET`
- Produces:
  - `interface ProvedorLogin { iniciarLogin(identificador: string): Promise<{ precisaSegredo: true }>; confirmarLogin(identificador: string, segredo: string): Promise<Usuario | null> }`
  - `provedorSenha: ProvedorLogin`
  - `gerarHash(senha: string): Promise<string>`
  - `criarSessao(usuarioId: string): Promise<void>` — grava o cookie
  - `lerSessao(): Promise<string | null>` — devolve o `usuarioId`
  - `encerrarSessao(): Promise<void>`
  - `usuarioAtual(): Promise<Usuario | null>`
  - `exigirUsuario(): Promise<Usuario>` — redireciona para `/login` se não houver
  - `exigirGestor(): Promise<Usuario>`

- [ ] **Step 1: Escrever os testes de senha**

`tests/auth/senha.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const usuarioFalso = {
  id: 'u1',
  nome: 'Danilo',
  telefone: '5521977237528',
  email: null,
  senhaHash: '',
  zapleAgentId: '79e78c4b-3261-4b82-9010-a471cc005787',
  papel: 'vendedor' as const,
  ativo: true,
  criadoEm: new Date(),
}

const buscarPorTelefone = vi.fn()
vi.mock('@/lib/auth/repositorio', () => ({ buscarPorTelefone }))

describe('login por senha', () => {
  beforeEach(() => {
    vi.resetModules()
    buscarPorTelefone.mockReset()
  })

  it('aceita a senha correta e devolve o usuário', async () => {
    const { gerarHash } = await import('@/lib/auth/senha')
    const { provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({ ...usuarioFalso, senhaHash: await gerarHash('segredo123') })

    const u = await provedorSenha.confirmarLogin('(21) 97723-7528', 'segredo123')

    expect(u?.id).toBe('u1')
  })

  it('recusa a senha errada', async () => {
    const { gerarHash, provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({ ...usuarioFalso, senhaHash: await gerarHash('segredo123') })

    expect(await provedorSenha.confirmarLogin('5521977237528', 'errada')).toBeNull()
  })

  it('busca pelo telefone normalizado, aceitando o que o usuário digitar', async () => {
    const { gerarHash, provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({ ...usuarioFalso, senhaHash: await gerarHash('s') })

    await provedorSenha.confirmarLogin('(21) 97723-7528', 's')

    expect(buscarPorTelefone).toHaveBeenCalledWith('5521977237528')
  })

  it('recusa usuário desativado mesmo com a senha certa', async () => {
    const { gerarHash, provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue({ ...usuarioFalso, ativo: false, senhaHash: await gerarHash('s') })

    expect(await provedorSenha.confirmarLogin('5521977237528', 's')).toBeNull()
  })

  it('recusa telefone inexistente sem vazar que ele não existe', async () => {
    const { provedorSenha } = await import('@/lib/auth/senha')
    buscarPorTelefone.mockResolvedValue(null)

    expect(await provedorSenha.confirmarLogin('5521900000000', 'qualquer')).toBeNull()
  })

  it('nunca guarda a senha em texto claro', async () => {
    const { gerarHash } = await import('@/lib/auth/senha')
    const hash = await gerarHash('segredo123')
    expect(hash).not.toContain('segredo123')
    expect(hash.startsWith('$2')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/auth/senha.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar a interface e o repositório**

`src/lib/auth/tipos.ts`:

```ts
import type { Usuario } from '@/lib/db/schema'

/**
 * A fronteira que permite trocar senha por OTP no WhatsApp sem tocar em tela
 * nenhuma (spec, seção 3.4). Hoje `iniciarLogin` é quase vazio; com OTP ele
 * passa a disparar o código.
 */
export interface ProvedorLogin {
  iniciarLogin(identificador: string): Promise<{ precisaSegredo: true }>
  confirmarLogin(identificador: string, segredo: string): Promise<Usuario | null>
}
```

`src/lib/auth/repositorio.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db, usuario, type Usuario } from '@/lib/db'

export async function buscarPorTelefone(telefone: string): Promise<Usuario | null> {
  const [achado] = await db.select().from(usuario).where(eq(usuario.telefone, telefone)).limit(1)
  return achado ?? null
}

export async function buscarPorId(id: string): Promise<Usuario | null> {
  const [achado] = await db.select().from(usuario).where(eq(usuario.id, id)).limit(1)
  return achado ?? null
}
```

`src/lib/auth/senha.ts`:

```ts
import bcrypt from 'bcryptjs'
import { normalizarTelefone } from '@/lib/zaple/contatos'
import { buscarPorTelefone } from './repositorio'
import type { ProvedorLogin } from './tipos'

const CUSTO = 12

export function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO)
}

export const provedorSenha: ProvedorLogin = {
  async iniciarLogin() {
    return { precisaSegredo: true }
  },

  async confirmarLogin(identificador, segredo) {
    const u = await buscarPorTelefone(normalizarTelefone(identificador))
    // Compara mesmo sem usuário, para que o tempo de resposta não revele
    // quais telefones existem na base.
    const hash = u?.senhaHash ?? '$2a$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalidoin'
    const confere = await bcrypt.compare(segredo, hash)
    if (!u || !confere || !u.ativo) return null
    return u
  },
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/auth/senha.test.ts`
Expected: PASS — 6 testes

- [ ] **Step 5: Escrever o teste da sessão**

`tests/auth/sessao.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const armazem = new Map<string, { value: string }>()
const cookiesFalso = {
  get: (n: string) => armazem.get(n),
  set: (n: string, v: string) => armazem.set(n, { value: v }),
  delete: (n: string) => armazem.delete(n),
}
vi.mock('next/headers', () => ({ cookies: async () => cookiesFalso }))

describe('sessão', () => {
  beforeEach(() => {
    vi.resetModules()
    armazem.clear()
    process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-bytes-aqui'
  })

  it('grava e lê o id do usuário', async () => {
    const { criarSessao, lerSessao } = await import('@/lib/auth/sessao')
    await criarSessao('u1')
    expect(await lerSessao()).toBe('u1')
  })

  it('grava o cookie como httpOnly, para o JavaScript da página não alcançá-lo', async () => {
    const set = vi.fn()
    vi.doMock('next/headers', () => ({ cookies: async () => ({ ...cookiesFalso, set }) }))
    vi.resetModules()
    const { criarSessao } = await import('@/lib/auth/sessao')

    await criarSessao('u1')

    expect(set.mock.calls[0][2]).toMatchObject({ httpOnly: true, sameSite: 'lax' })
  })

  it('devolve null quando não há cookie', async () => {
    const { lerSessao } = await import('@/lib/auth/sessao')
    expect(await lerSessao()).toBeNull()
  })

  it('recusa token adulterado', async () => {
    const { lerSessao } = await import('@/lib/auth/sessao')
    armazem.set('sessao', { value: 'eyJhbGciOiJIUzI1NiJ9.mentira.assinatura' })
    expect(await lerSessao()).toBeNull()
  })

  it('encerrar apaga o cookie', async () => {
    const { criarSessao, encerrarSessao, lerSessao } = await import('@/lib/auth/sessao')
    await criarSessao('u1')
    await encerrarSessao()
    expect(await lerSessao()).toBeNull()
  })
})
```

- [ ] **Step 6: Implementar a sessão**

`src/lib/auth/sessao.ts`:

```ts
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const NOME = 'sessao'
const DIAS = 30

function chave(): Uint8Array {
  const segredo = process.env.SESSION_SECRET
  if (!segredo) throw new Error('SESSION_SECRET não configurado')
  return new TextEncoder().encode(segredo)
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = await new SignJWT({ sub: usuarioId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(chave())

  const jar = await cookies()
  jar.set(NOME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DIAS * 24 * 60 * 60,
  })
}

export async function lerSessao(): Promise<string | null> {
  const token = (await cookies()).get(NOME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, chave())
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export async function encerrarSessao(): Promise<void> {
  ;(await cookies()).delete(NOME)
}
```

`src/lib/auth/atual.ts`:

```ts
import { redirect } from 'next/navigation'
import { buscarPorId } from './repositorio'
import { lerSessao } from './sessao'
import type { Usuario } from '@/lib/db'

/**
 * Revalida `ativo` a cada requisição. É o que permite desligar alguém na hora
 * sem manter uma tabela de sessões (spec, seção 3.4).
 */
export async function usuarioAtual(): Promise<Usuario | null> {
  const id = await lerSessao()
  if (!id) return null
  const u = await buscarPorId(id)
  return u?.ativo ? u : null
}

export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual()
  if (!u) redirect('/login')
  return u
}

export async function exigirGestor(): Promise<Usuario> {
  const u = await exigirUsuario()
  if (u.papel !== 'gestor') redirect('/kanban')
  return u
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npx vitest run tests/auth`
Expected: PASS — 11 testes

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth tests/auth
git commit -m "feat(auth): login por senha atrás de interface trocável e sessão em cookie"
```

---

## Task 8: Telas de login e proteção de rotas

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/FormLogin.tsx`
- Create: `src/app/api/login/route.ts`, `src/app/api/logout/route.ts`
- Create: `src/app/(app)/layout.tsx`
- Modify: `src/app/page.tsx` — redirecionar para `/kanban`
- Test: `tests/api/login.test.ts`

**Interfaces:**
- Consumes: `provedorSenha` (Task 7), `criarSessao`, `encerrarSessao`, `exigirUsuario` (Task 7), `tentativaLogin` (Task 6)
- Produces:
  - `registrarTentativa(identificador: string): Promise<void>`
  - `excedeuTentativas(identificador: string): Promise<boolean>`
  - rota `POST /api/login` `{ telefone, senha }` → 200 `{ ok: true }`, 401 `{ erro }`, 429 `{ erro }`
  - rota `POST /api/logout`; layout `(app)` que exige sessão

- [ ] **Step 1: Escrever o teste da rota de login**

`tests/api/login.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const confirmarLogin = vi.fn()
const criarSessao = vi.fn()
const excedeuTentativas = vi.fn()
const registrarTentativa = vi.fn()
vi.mock('@/lib/auth/senha', () => ({ provedorSenha: { confirmarLogin, iniciarLogin: vi.fn() } }))
vi.mock('@/lib/auth/sessao', () => ({ criarSessao, encerrarSessao: vi.fn() }))
vi.mock('@/lib/auth/limite', () => ({ excedeuTentativas, registrarTentativa }))

function pedido(corpo: unknown) {
  return new Request('http://local/api/login', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/login', () => {
  beforeEach(() => {
    vi.resetModules()
    confirmarLogin.mockReset()
    criarSessao.mockReset()
    excedeuTentativas.mockReset()
    excedeuTentativas.mockResolvedValue(false)
    registrarTentativa.mockReset()
  })

  it('cria a sessão quando as credenciais conferem', async () => {
    confirmarLogin.mockResolvedValue({ id: 'u1', papel: 'vendedor' })
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '21977237528', senha: 'segredo123' }))

    expect(r.status).toBe(200)
    expect(criarSessao).toHaveBeenCalledWith('u1')
  })

  it('responde 401 sem dizer se foi o telefone ou a senha', async () => {
    confirmarLogin.mockResolvedValue(null)
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '21977237528', senha: 'errada' }))
    const corpo = await r.json()

    expect(r.status).toBe(401)
    expect(corpo.erro).toBe('Telefone ou senha incorretos')
    expect(criarSessao).not.toHaveBeenCalled()
  })

  it('responde 400 quando o corpo não tem o formato esperado', async () => {
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '' }))

    expect(r.status).toBe(400)
    expect(confirmarLogin).not.toHaveBeenCalled()
  })

  it('registra cada tentativa fracassada', async () => {
    confirmarLogin.mockResolvedValue(null)
    const { POST } = await import('@/app/api/login/route')

    await POST(pedido({ telefone: '21977237528', senha: 'errada' }))

    expect(registrarTentativa).toHaveBeenCalledWith('5521977237528')
  })

  it('responde 429 e nem testa a senha quando o limite estourou', async () => {
    excedeuTentativas.mockResolvedValue(true)
    const { POST } = await import('@/app/api/login/route')

    const r = await POST(pedido({ telefone: '21977237528', senha: 'chute' }))

    expect(r.status).toBe(429)
    expect(confirmarLogin).not.toHaveBeenCalled()
  })

  it('não registra tentativa quando o login dá certo', async () => {
    confirmarLogin.mockResolvedValue({ id: 'u1', papel: 'vendedor' })
    const { POST } = await import('@/app/api/login/route')

    await POST(pedido({ telefone: '21977237528', senha: 'segredo123' }))

    expect(registrarTentativa).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/login.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar o limitador de tentativas**

`src/lib/auth/limite.ts`:

```ts
import { and, eq, gte, sql } from 'drizzle-orm'
import { db, tentativaLogin } from '@/lib/db'

const JANELA_MINUTOS = 15
const MAXIMO = 8

export async function registrarTentativa(identificador: string): Promise<void> {
  await db.insert(tentativaLogin).values({ identificador })
}

export async function excedeuTentativas(identificador: string): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000)
  const [linha] = await db
    .select({ quantas: sql<number>`count(*)::int` })
    .from(tentativaLogin)
    .where(and(eq(tentativaLogin.identificador, identificador), gte(tentativaLogin.emJanela, desde)))
  return (linha?.quantas ?? 0) >= MAXIMO
}
```

- [ ] **Step 4: Implementar as rotas**

`src/app/api/login/route.ts`:

```ts
import { z } from 'zod'
import { provedorSenha } from '@/lib/auth/senha'
import { criarSessao } from '@/lib/auth/sessao'
import { excedeuTentativas, registrarTentativa } from '@/lib/auth/limite'
import { normalizarTelefone } from '@/lib/zaple/contatos'

const Entrada = z.object({
  telefone: z.string().min(10),
  senha: z.string().min(1),
})

export async function POST(req: Request) {
  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json({ erro: 'Informe telefone e senha' }, { status: 400 })
  }

  // Limita por telefone alvo: sem isso, a lista de celulares da equipe vira
  // uma lista de alvos para força bruta (spec, seção 9).
  const identificador = normalizarTelefone(analisado.data.telefone)
  if (await excedeuTentativas(identificador)) {
    return Response.json(
      { erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' },
      { status: 429 }
    )
  }

  const u = await provedorSenha.confirmarLogin(analisado.data.telefone, analisado.data.senha)
  if (!u) {
    await registrarTentativa(identificador)
    // Mensagem única de propósito: dizer "esse telefone não existe" entrega
    // a lista de quem trabalha aqui para quem estiver testando.
    return Response.json({ erro: 'Telefone ou senha incorretos' }, { status: 401 })
  }

  await criarSessao(u.id)
  return Response.json({ ok: true })
}
```

`src/app/api/logout/route.ts`:

```ts
import { encerrarSessao } from '@/lib/auth/sessao'

export async function POST() {
  await encerrarSessao()
  return Response.json({ ok: true })
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/login.test.ts`
Expected: PASS — 6 testes

- [ ] **Step 6: Tela de login**

`src/app/login/FormLogin.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FormLogin() {
  const router = useRouter()
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telefone, senha }),
      })
      if (!r.ok) {
        setErro((await r.json()).erro ?? 'Não foi possível entrar')
        return
      }
      router.replace('/kanban')
      router.refresh()
    } catch {
      setErro('Sem conexão. Verifique a internet e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Celular</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="username"
          required
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(21) 99999-9999"
          className="rounded-lg border border-slate-300 px-4 py-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Senha</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3 text-base"
        />
      </label>

      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
```

`src/app/login/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/auth/atual'
import { FormLogin } from './FormLogin'

export default async function Login() {
  if (await usuarioAtual()) redirect('/kanban')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-2xl font-semibold">Gestão de Visitas</h1>
      <FormLogin />
    </main>
  )
}
```

- [ ] **Step 7: Layout autenticado e redirecionamento da raiz**

`src/app/(app)/layout.tsx`:

```tsx
import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/kanban" className="font-semibold">Visitas</Link>
        <div className="flex items-center gap-3 text-sm">
          {u.papel === 'gestor' && <Link href="/admin" className="text-slate-600">Admin</Link>}
          <span className="text-slate-500">{u.nome}</span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

`src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Raiz() {
  redirect('/kanban')
}
```

- [ ] **Step 8: Conferir o fluxo no navegador**

Run: `npm run dev`
Abrir `http://localhost:3000` → deve redirecionar para `/login`. Errar a senha nove vezes seguidas → a nona deve responder "Muitas tentativas".

- [ ] **Step 9: Commit**

```bash
git add src/app src/lib/auth tests/api
git commit -m "feat(auth): login, proteção de rotas e limite de tentativas"
```

---

## Task 9: Admin de usuários

**Files:**
- Create: `src/app/(app)/admin/page.tsx`, `src/app/(app)/admin/FormUsuario.tsx`
- Create: `src/app/api/usuarios/route.ts`, `src/app/api/usuarios/[id]/route.ts`
- Create: `src/lib/auth/usuarios.ts`
- Create: `scripts/criar-gestor.ts`
- Test: `tests/api/usuarios.test.ts`

**Interfaces:**
- Consumes: `db`, `usuario` (Task 6); `gerarHash` (Task 7); `exigirGestor` (Task 7); `listarAgentes` (Task 5); `normalizarTelefone` (Task 5)
- Produces:
  - `criarUsuario(entrada: { nome; telefone; email?; senha; zapleAgentId; papel }): Promise<Usuario>`
  - `listarUsuarios(): Promise<Usuario[]>`
  - `alterarUsuario(id, patch: { ativo?; papel?; senha? }): Promise<void>`
  - `GET/POST /api/usuarios`, `PATCH /api/usuarios/[id]`

- [ ] **Step 1: Escrever o teste**

`tests/api/usuarios.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirGestor = vi.fn()
const criarUsuario = vi.fn()
const listarAgentes = vi.fn()
vi.mock('@/lib/auth/atual', () => ({ exigirGestor, exigirUsuario: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/auth/usuarios', () => ({ criarUsuario, listarUsuarios: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/zaple/agentes', () => ({ listarAgentes }))

function pedido(corpo: unknown) {
  return new Request('http://local/api/usuarios', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

const VALIDO = {
  nome: 'Danilo',
  telefone: '(21) 97723-7528',
  senha: 'segredo123',
  zapleAgentId: '79e78c4b-3261-4b82-9010-a471cc005787',
  papel: 'vendedor',
}

describe('POST /api/usuarios', () => {
  beforeEach(() => {
    vi.resetModules()
    exigirGestor.mockResolvedValue({ id: 'g1', papel: 'gestor' })
    listarAgentes.mockResolvedValue([{ id: VALIDO.zapleAgentId, nome: 'Danilo', email: null }])
    criarUsuario.mockReset()
    criarUsuario.mockResolvedValue({ id: 'u1' })
  })

  it('cria o usuário quando o agente existe no Zaple', async () => {
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido(VALIDO))

    expect(r.status).toBe(201)
    expect(criarUsuario).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Danilo' }))
  })

  it('recusa agente do Zaple inexistente', async () => {
    // Vincular a um agente que não existe cria um vendedor que nunca vê visita.
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido({ ...VALIDO, zapleAgentId: '00000000-0000-0000-0000-000000000000' }))

    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ erro: expect.stringContaining('agente') })
    expect(criarUsuario).not.toHaveBeenCalled()
  })

  it('exige senha com pelo menos 8 caracteres', async () => {
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido({ ...VALIDO, senha: 'curta' }))

    expect(r.status).toBe(400)
    expect(criarUsuario).not.toHaveBeenCalled()
  })

  it('devolve 409 quando o telefone já está cadastrado', async () => {
    criarUsuario.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
    const { POST } = await import('@/app/api/usuarios/route')

    const r = await POST(pedido(VALIDO))

    expect(r.status).toBe(409)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/usuarios.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar as operações de usuário**

`src/lib/auth/usuarios.ts`:

```ts
import { asc, eq } from 'drizzle-orm'
import { db, usuario, type Usuario } from '@/lib/db'
import { normalizarTelefone } from '@/lib/zaple/contatos'
import { gerarHash } from './senha'

export type NovaEntradaUsuario = {
  nome: string
  telefone: string
  email?: string | null
  senha: string
  zapleAgentId: string
  papel: 'vendedor' | 'gestor'
}

export async function criarUsuario(entrada: NovaEntradaUsuario): Promise<Usuario> {
  const [criado] = await db
    .insert(usuario)
    .values({
      nome: entrada.nome,
      telefone: normalizarTelefone(entrada.telefone),
      email: entrada.email ?? null,
      senhaHash: await gerarHash(entrada.senha),
      zapleAgentId: entrada.zapleAgentId,
      papel: entrada.papel,
    })
    .returning()
  return criado
}

export function listarUsuarios(): Promise<Usuario[]> {
  return db.select().from(usuario).orderBy(asc(usuario.nome))
}

export async function alterarUsuario(
  id: string,
  patch: { ativo?: boolean; papel?: 'vendedor' | 'gestor'; senha?: string }
): Promise<void> {
  const valores: Record<string, unknown> = {}
  if (patch.ativo !== undefined) valores.ativo = patch.ativo
  if (patch.papel !== undefined) valores.papel = patch.papel
  if (patch.senha) valores.senhaHash = await gerarHash(patch.senha)
  if (Object.keys(valores).length === 0) return
  await db.update(usuario).set(valores).where(eq(usuario.id, id))
}
```

- [ ] **Step 4: Implementar as rotas**

`src/app/api/usuarios/route.ts`:

```ts
import { z } from 'zod'
import { exigirGestor } from '@/lib/auth/atual'
import { criarUsuario, listarUsuarios } from '@/lib/auth/usuarios'
import { listarAgentes } from '@/lib/zaple/agentes'

const Entrada = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(10),
  email: z.string().email().nullable().optional(),
  senha: z.string().min(8),
  zapleAgentId: z.string().uuid(),
  papel: z.enum(['vendedor', 'gestor']),
})

export async function GET() {
  await exigirGestor()
  const [usuarios, agentes] = await Promise.all([listarUsuarios(), listarAgentes()])
  return Response.json({
    usuarios: usuarios.map(({ senhaHash: _ignorado, ...resto }) => resto),
    agentes,
  })
}

export async function POST(req: Request) {
  await exigirGestor()

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json({ erro: 'Dados inválidos: ' + analisado.error.issues[0].message }, { status: 400 })
  }

  // Vincular a um agente inexistente produz um vendedor que nunca enxerga
  // visita nenhuma — e o sintoma só aparece dias depois, em campo.
  const agentes = await listarAgentes()
  if (!agentes.some((a) => a.id === analisado.data.zapleAgentId)) {
    return Response.json({ erro: 'Esse agente não existe no Zaple' }, { status: 400 })
  }

  try {
    const criado = await criarUsuario(analisado.data)
    return Response.json({ id: criado.id }, { status: 201 })
  } catch (erro) {
    if ((erro as { code?: string }).code === '23505') {
      return Response.json({ erro: 'Já existe usuário com esse telefone' }, { status: 409 })
    }
    throw erro
  }
}
```

`src/app/api/usuarios/[id]/route.ts`:

```ts
import { z } from 'zod'
import { exigirGestor } from '@/lib/auth/atual'
import { alterarUsuario } from '@/lib/auth/usuarios'

const Patch = z.object({
  ativo: z.boolean().optional(),
  papel: z.enum(['vendedor', 'gestor']).optional(),
  senha: z.string().min(8).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await exigirGestor()
  const { id } = await params

  const analisado = Patch.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Dados inválidos' }, { status: 400 })

  await alterarUsuario(id, analisado.data)
  return Response.json({ ok: true })
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/usuarios.test.ts`
Expected: PASS — 4 testes

- [ ] **Step 6: Tela de admin**

`src/app/(app)/admin/FormUsuario.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Agente } from '@/lib/zaple/tipos'

export function FormUsuario({ agentes }: { agentes: Agente[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const dados = Object.fromEntries(new FormData(e.currentTarget))

    const r = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...dados, email: dados.email || null }),
    })

    setEnviando(false)
    if (!r.ok) {
      setErro((await r.json()).erro ?? 'Não foi possível cadastrar')
      return
    }
    e.currentTarget.reset()
    router.refresh()
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <input name="nome" required placeholder="Nome" className="rounded border border-slate-300 px-3 py-2" />
      <input name="telefone" required placeholder="Celular" className="rounded border border-slate-300 px-3 py-2" />
      <input name="email" type="email" placeholder="E-mail (opcional)" className="rounded border border-slate-300 px-3 py-2" />
      <input name="senha" required minLength={8} type="password" placeholder="Senha (mín. 8)" className="rounded border border-slate-300 px-3 py-2" />

      <select name="zapleAgentId" required defaultValue="" className="rounded border border-slate-300 px-3 py-2">
        <option value="" disabled>Agente no Zaple…</option>
        {agentes.map((a) => (
          <option key={a.id} value={a.id}>{a.nome}</option>
        ))}
      </select>

      <select name="papel" defaultValue="vendedor" className="rounded border border-slate-300 px-3 py-2">
        <option value="vendedor">Vendedor</option>
        <option value="gestor">Gestor</option>
      </select>

      {erro && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{erro}</p>}

      <button disabled={enviando} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2">
        {enviando ? 'Cadastrando…' : 'Cadastrar vendedor'}
      </button>
    </form>
  )
}
```

`src/app/(app)/admin/page.tsx`:

```tsx
import { exigirGestor } from '@/lib/auth/atual'
import { listarUsuarios } from '@/lib/auth/usuarios'
import { listarAgentes } from '@/lib/zaple/agentes'
import { FormUsuario } from './FormUsuario'

export default async function Admin() {
  await exigirGestor()
  const [usuarios, agentes] = await Promise.all([listarUsuarios(), listarAgentes()])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Vendedores</h1>
      <FormUsuario agentes={agentes} />

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {usuarios.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{u.nome}</p>
              <p className="text-sm text-slate-500">{u.telefone} · {u.papel}</p>
            </div>
            <span className={u.ativo ? 'text-sm text-emerald-600' : 'text-sm text-slate-400'}>
              {u.ativo ? 'ativo' : 'inativo'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 7: Script para criar o primeiro gestor**

Sem isso ninguém consegue entrar na tela que cadastra pessoas.

`scripts/criar-gestor.ts`:

```ts
import { criarUsuario } from '@/lib/auth/usuarios'
import { listarAgentes } from '@/lib/zaple/agentes'

const [nome, telefone, senha, agentId] = process.argv.slice(2)
if (!nome || !telefone || !senha || !agentId) {
  console.error('uso: criar-gestor.ts <nome> <telefone> <senha> <zapleAgentId>')
  console.error('\nAgentes disponíveis no Zaple:')
  console.table(await listarAgentes())
  process.exit(1)
}

const u = await criarUsuario({ nome, telefone, senha, zapleAgentId: agentId, papel: 'gestor' })
console.log('gestor criado:', u.id)
```

Run: `npx tsx --env-file=.env scripts/criar-gestor.ts` (sem argumentos, para ver a lista de agentes) e depois com os argumentos.

- [ ] **Step 8: Commit**

```bash
git add src/app src/lib/auth scripts tests/api
git commit -m "feat(admin): cadastro de vendedores vinculados ao agente do Zaple"
```

---

## Task 10: Kanban

**Files:**
- Create: `src/app/(app)/kanban/page.tsx`, `src/app/(app)/kanban/Quadro.tsx`, `src/app/(app)/kanban/CartaoVisita.tsx`
- Create: `src/app/api/visitas/route.ts`
- Create: `src/lib/visita/regras.ts`
- Test: `tests/visita/regras.test.ts`, `tests/api/visitas.test.ts`

**Interfaces:**
- Consumes: `listarVisitas`, `listarEtapas` (Tasks 3-4); `exigirUsuario` (Task 7)
- Produces:
  - `proximaEtapa(etapas: Etapa[], atualId: string): Etapa | null`
  - `podeMover(etapas: Etapa[], deId: string, paraId: string): boolean`
  - `GET /api/visitas?etapaId=&todos=` → `{ itens: Visita[] }`

- [ ] **Step 1: Escrever os testes das regras**

`tests/visita/regras.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { proximaEtapa, podeMover } from '@/lib/visita/regras'
import type { Etapa } from '@/lib/zaple/tipos'

const ETAPAS: Etapa[] = [
  { id: 'e1', titulo: 'Prospecção', posicao: 1, inicial: true, final: false },
  { id: 'e2', titulo: 'Visita', posicao: 2, inicial: false, final: false },
  { id: 'e3', titulo: 'RECORRENTE', posicao: 3, inicial: false, final: false },
  { id: 'e4', titulo: 'Concluído', posicao: 4, inicial: false, final: true },
]

describe('proximaEtapa', () => {
  it('avança uma posição', () => {
    expect(proximaEtapa(ETAPAS, 'e1')?.id).toBe('e2')
    expect(proximaEtapa(ETAPAS, 'e3')?.id).toBe('e4')
  })

  it('não avança além da etapa final', () => {
    expect(proximaEtapa(ETAPAS, 'e4')).toBeNull()
  })

  it('devolve null para etapa desconhecida em vez de escolher uma qualquer', () => {
    expect(proximaEtapa(ETAPAS, 'inexistente')).toBeNull()
  })
})

describe('podeMover', () => {
  it('permite ir para qualquer etapa existente, inclusive voltando', () => {
    // O vendedor reorganiza o dia à mão; travar o retrocesso só gera card preso.
    expect(podeMover(ETAPAS, 'e3', 'e1')).toBe(true)
    expect(podeMover(ETAPAS, 'e1', 'e4')).toBe(true)
  })

  it('recusa etapa que não pertence ao painel', () => {
    expect(podeMover(ETAPAS, 'e1', 'outra')).toBe(false)
  })

  it('recusa mover para a própria etapa, que só gastaria uma chamada à API', () => {
    expect(podeMover(ETAPAS, 'e2', 'e2')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/visita/regras.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar as regras**

`src/lib/visita/regras.ts`:

```ts
import type { Etapa } from '@/lib/zaple/tipos'

export function proximaEtapa(etapas: Etapa[], atualId: string): Etapa | null {
  const ordenadas = [...etapas].sort((a, b) => a.posicao - b.posicao)
  const indice = ordenadas.findIndex((e) => e.id === atualId)
  if (indice === -1) return null
  return ordenadas[indice + 1] ?? null
}

export function podeMover(etapas: Etapa[], deId: string, paraId: string): boolean {
  if (deId === paraId) return false
  return etapas.some((e) => e.id === deId) && etapas.some((e) => e.id === paraId)
}
```

- [ ] **Step 4: Escrever o teste da rota**

`tests/api/visitas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const listarVisitas = vi.fn()
vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ listarVisitas }))

const VENDEDOR = { id: 'u1', papel: 'vendedor', zapleAgentId: 'agente-1' }
const GESTOR = { id: 'g1', papel: 'gestor', zapleAgentId: 'agente-9' }

describe('GET /api/visitas', () => {
  beforeEach(() => {
    vi.resetModules()
    listarVisitas.mockReset()
    listarVisitas.mockResolvedValue({ itens: [], total: 0, temMais: false })
  })

  it('vendedor só recebe as visitas dele', async () => {
    exigirUsuario.mockResolvedValue(VENDEDOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-1' }))
  })

  it('vendedor não escapa do filtro pedindo todos', async () => {
    exigirUsuario.mockResolvedValue(VENDEDOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas?todos=1'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-1' }))
  })

  it('gestor pedindo todos vê o painel inteiro', async () => {
    exigirUsuario.mockResolvedValue(GESTOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas?todos=1'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: undefined }))
  })

  it('gestor sem pedir todos vê apenas as próprias', async () => {
    exigirUsuario.mockResolvedValue(GESTOR)
    const { GET } = await import('@/app/api/visitas/route')

    await GET(new Request('http://local/api/visitas'))

    expect(listarVisitas).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-9' }))
  })
})
```

- [ ] **Step 5: Implementar a rota**

`src/app/api/visitas/route.ts`:

```ts
import { exigirUsuario } from '@/lib/auth/atual'
import { listarVisitas } from '@/lib/zaple/visitas'

export async function GET(req: Request) {
  const u = await exigirUsuario()
  const url = new URL(req.url)

  // "Ver todos" é privilégio do gestor. Um vendedor que passe ?todos=1 na mão
  // continua vendo apenas as próprias visitas.
  const todos = url.searchParams.get('todos') === '1' && u.papel === 'gestor'

  const pagina = await listarVisitas({
    etapaId: url.searchParams.get('etapaId') ?? undefined,
    busca: url.searchParams.get('busca') ?? undefined,
    responsavelId: todos ? undefined : u.zapleAgentId,
  })

  return Response.json(pagina)
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx vitest run tests/visita tests/api/visitas.test.ts`
Expected: PASS — 10 testes

- [ ] **Step 7: Cartão de visita**

`src/app/(app)/kanban/CartaoVisita.tsx`:

```tsx
'use client'
import Link from 'next/link'
import type { Visita } from '@/lib/zaple/tipos'

function formatarPrazo(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso))
}

export function CartaoVisita({
  visita,
  rotuloProxima,
  onAvancar,
  movendo,
}: {
  visita: Visita
  rotuloProxima: string | null
  onAvancar: () => void
  movendo: boolean
}) {
  const prazo = formatarPrazo(visita.prazo)

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Link href={`/visita/${visita.id}`} className="block">
        <h3 className="font-medium leading-snug">{visita.titulo}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {visita.chave}
          {visita.contatos[0] && ` · ${visita.contatos[0].nome}`}
        </p>
        {prazo && (
          <p className={`mt-1 text-xs ${visita.atrasada ? 'font-medium text-red-600' : 'text-slate-500'}`}>
            {visita.atrasada ? 'Atrasada — ' : ''}{prazo}
          </p>
        )}
      </Link>

      {rotuloProxima && (
        <button
          onClick={onAvancar}
          disabled={movendo}
          className="mt-3 w-full rounded border border-slate-300 py-2 text-sm font-medium disabled:opacity-50"
        >
          {movendo ? 'Movendo…' : `Avançar para ${rotuloProxima}`}
        </button>
      )}
    </article>
  )
}
```

- [ ] **Step 8: Quadro, uma etapa por vez no celular**

`src/app/(app)/kanban/Quadro.tsx`:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Etapa, Visita } from '@/lib/zaple/tipos'
import { proximaEtapa } from '@/lib/visita/regras'
import { CartaoVisita } from './CartaoVisita'

export function Quadro({
  etapas,
  visitas,
  podeVerTodos,
  vendoTodos,
}: {
  etapas: Etapa[]
  visitas: Visita[]
  podeVerTodos: boolean
  vendoTodos: boolean
}) {
  const router = useRouter()
  const [etapaAtiva, setEtapaAtiva] = useState(etapas[0]?.id ?? '')
  const [movendoId, setMovendoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, iniciarTransicao] = useTransition()

  async function avancar(visita: Visita) {
    const destino = proximaEtapa(etapas, visita.etapaId)
    if (!destino) return
    setMovendoId(visita.id)
    setErro(null)

    const r = await fetch(`/api/visitas/${visita.id}/mover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ etapaId: destino.id, etapaAtualId: visita.etapaId }),
    })

    setMovendoId(null)
    if (!r.ok) {
      setErro((await r.json()).erro ?? 'Não foi possível mover a visita')
      return
    }
    iniciarTransicao(() => router.refresh())
  }

  const daEtapa = visitas.filter((v) => v.etapaId === etapaAtiva)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        {podeVerTodos && (
          <Link
            href={vendoTodos ? '/kanban' : '/kanban?todos=1'}
            className="text-sm text-slate-600 underline"
          >
            {vendoTodos ? 'Ver só as minhas' : 'Ver todos'}
          </Link>
        )}
        <Link href="/visita/nova" className="ml-auto rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Nova visita
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Etapas">
        {etapas.map((e) => {
          const quantidade = visitas.filter((v) => v.etapaId === e.id).length
          const ativa = e.id === etapaAtiva
          return (
            <button
              key={e.id}
              onClick={() => setEtapaAtiva(e.id)}
              aria-current={ativa}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                ativa ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {e.titulo} ({quantidade})
            </button>
          )
        })}
      </nav>

      {erro && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {daEtapa.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">Nenhuma visita nesta etapa.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {daEtapa.map((v) => (
            <CartaoVisita
              key={v.id}
              visita={v}
              rotuloProxima={proximaEtapa(etapas, v.etapaId)?.titulo ?? null}
              onAvancar={() => avancar(v)}
              movendo={movendoId === v.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

`src/app/(app)/kanban/page.tsx`:

```tsx
import { exigirUsuario } from '@/lib/auth/atual'
import { listarEtapas } from '@/lib/zaple/painel'
import { listarVisitas } from '@/lib/zaple/visitas'
import { Quadro } from './Quadro'

export const dynamic = 'force-dynamic'

export default async function Kanban({
  searchParams,
}: {
  searchParams: Promise<{ todos?: string }>
}) {
  const u = await exigirUsuario()
  const { todos } = await searchParams
  const vendoTodos = todos === '1' && u.papel === 'gestor'

  const [etapas, pagina] = await Promise.all([
    listarEtapas(),
    listarVisitas({ responsavelId: vendoTodos ? undefined : u.zapleAgentId }),
  ])

  return (
    <Quadro
      etapas={etapas}
      visitas={pagina.itens}
      podeVerTodos={u.papel === 'gestor'}
      vendoTodos={vendoTodos}
    />
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add src/app src/lib/visita tests/visita tests/api/visitas.test.ts
git commit -m "feat(kanban): quadro de visitas por etapa com filtro por responsável"
```

---

## Task 11: Mover etapa com verificação de concorrência

**Files:**
- Create: `src/app/api/visitas/[id]/mover/route.ts`
- Test: `tests/api/mover.test.ts`

**Interfaces:**
- Consumes: `obterVisita`, `moverEtapa` (Task 4); `listarEtapas` (Task 3); `podeMover` (Task 10); `exigirUsuario` (Task 7)
- Produces: `POST /api/visitas/[id]/mover` `{ etapaId, etapaAtualId }` → 200 `{ visita }`, 409 se outra pessoa já moveu, 403 se não é a visita do vendedor

- [ ] **Step 1: Escrever o teste**

`tests/api/mover.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const obterVisita = vi.fn()
const moverEtapa = vi.fn()
const listarEtapas = vi.fn()
vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ obterVisita, moverEtapa }))
vi.mock('@/lib/zaple/painel', () => ({ listarEtapas, painelId: () => 'p1' }))

const ETAPAS = [
  { id: 'e1', titulo: 'Prospecção', posicao: 1, inicial: true, final: false },
  { id: 'e2', titulo: 'Visita', posicao: 2, inicial: false, final: false },
]

function pedido(corpo: unknown) {
  return new Request('http://local/api/visitas/v1/mover', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}
const params = { params: Promise.resolve({ id: 'v1' }) }

describe('POST /api/visitas/[id]/mover', () => {
  beforeEach(() => {
    vi.resetModules()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleAgentId: 'agente-1' })
    listarEtapas.mockResolvedValue(ETAPAS)
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: 'e1', responsavelId: 'agente-1' })
    moverEtapa.mockReset()
    moverEtapa.mockResolvedValue({ id: 'v1', etapaId: 'e2' })
  })

  it('move quando a etapa atual confere', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: 'e2', etapaAtualId: 'e1' }), params)

    expect(r.status).toBe(200)
    expect(moverEtapa).toHaveBeenCalledWith('v1', 'e2')
  })

  it('responde 409 quando alguém já moveu o card no Zaple', async () => {
    // Sem esta verificação o app sobrescreveria o trabalho do colega calado
    // (spec, seção 8).
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: 'e2', responsavelId: 'agente-1' })
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: 'e1', etapaAtualId: 'e1' }), params)

    expect(r.status).toBe(409)
    expect(moverEtapa).not.toHaveBeenCalled()
  })

  it('recusa vendedor movendo visita de outro', async () => {
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: 'e1', responsavelId: 'agente-outro' })
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: 'e2', etapaAtualId: 'e1' }), params)

    expect(r.status).toBe(403)
    expect(moverEtapa).not.toHaveBeenCalled()
  })

  it('deixa o gestor mover a visita de qualquer um', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleAgentId: 'agente-9' })
    obterVisita.mockResolvedValue({ id: 'v1', etapaId: 'e1', responsavelId: 'agente-outro' })
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: 'e2', etapaAtualId: 'e1' }), params)

    expect(r.status).toBe(200)
  })

  it('recusa etapa que não pertence ao painel', async () => {
    const { POST } = await import('@/app/api/visitas/[id]/mover/route')

    const r = await POST(pedido({ etapaId: 'inventada', etapaAtualId: 'e1' }), params)

    expect(r.status).toBe(400)
    expect(moverEtapa).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/mover.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

`src/app/api/visitas/[id]/mover/route.ts`:

```ts
import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarEtapas } from '@/lib/zaple/painel'
import { moverEtapa, obterVisita } from '@/lib/zaple/visitas'
import { podeMover } from '@/lib/visita/regras'

const Entrada = z.object({
  etapaId: z.string().uuid(),
  etapaAtualId: z.string().uuid(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Entrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Dados inválidos' }, { status: 400 })

  const [etapas, visita] = await Promise.all([listarEtapas(), obterVisita(id)])

  if (u.papel !== 'gestor' && visita.responsavelId !== u.zapleAgentId) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  if (!podeMover(etapas, visita.etapaId, analisado.data.etapaId)) {
    return Response.json({ erro: 'Etapa de destino inválida' }, { status: 400 })
  }

  // O card pode ter sido movido no Zaple enquanto a tela estava aberta.
  // Avisar é melhor do que sobrescrever em silêncio (spec, seção 8).
  if (visita.etapaId !== analisado.data.etapaAtualId) {
    return Response.json(
      { erro: `Esta visita já foi movida para "${visita.etapaTitulo ?? 'outra etapa'}". Atualize a tela.` },
      { status: 409 }
    )
  }

  const movida = await moverEtapa(id, analisado.data.etapaId)
  return Response.json({ visita: movida })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/mover.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 5: Commit**

```bash
git add src/app/api tests/api/mover.test.ts
git commit -m "feat(kanban): mover etapa verificando concorrência e propriedade"
```

---

## Task 12: Detalhe da visita

**Files:**
- Create: `src/app/(app)/visita/[id]/page.tsx`
- Create: `src/app/api/visitas/[id]/route.ts`
- Test: `tests/api/visita-detalhe.test.ts`

**Interfaces:**
- Consumes: `obterVisita` (Task 4); `exigirUsuario` (Task 7)
- Produces: `GET /api/visitas/[id]` → 200 `{ visita }` ou 403

- [ ] **Step 1: Escrever o teste**

`tests/api/visita-detalhe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const obterVisita = vi.fn()
vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ obterVisita }))

const params = { params: Promise.resolve({ id: 'v1' }) }

describe('GET /api/visitas/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    obterVisita.mockResolvedValue({ id: 'v1', titulo: 'Padaria', responsavelId: 'agente-1' })
  })

  it('devolve a visita do próprio vendedor', async () => {
    exigirUsuario.mockResolvedValue({ papel: 'vendedor', zapleAgentId: 'agente-1' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    const r = await GET(new Request('http://local'), params)

    expect(r.status).toBe(200)
    expect((await r.json()).visita.titulo).toBe('Padaria')
  })

  it('recusa a visita de outro vendedor', async () => {
    exigirUsuario.mockResolvedValue({ papel: 'vendedor', zapleAgentId: 'agente-2' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    expect((await GET(new Request('http://local'), params)).status).toBe(403)
  })

  it('gestor vê qualquer visita', async () => {
    exigirUsuario.mockResolvedValue({ papel: 'gestor', zapleAgentId: 'agente-9' })
    const { GET } = await import('@/app/api/visitas/[id]/route')

    expect((await GET(new Request('http://local'), params)).status).toBe(200)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/visita-detalhe.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar a rota**

`src/app/api/visitas/[id]/route.ts`:

```ts
import { exigirUsuario } from '@/lib/auth/atual'
import { obterVisita } from '@/lib/zaple/visitas'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario()
  const { id } = await params

  const visita = await obterVisita(id)
  if (u.papel !== 'gestor' && visita.responsavelId !== u.zapleAgentId) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  return Response.json({ visita })
}
```

- [ ] **Step 4: Implementar a tela**

`src/app/(app)/visita/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/auth/atual'
import { obterVisita } from '@/lib/zaple/visitas'
import { ZapleError } from '@/lib/zaple/erros'

export const dynamic = 'force-dynamic'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso))
}

export default async function DetalheVisita({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario()
  const { id } = await params

  let visita
  try {
    visita = await obterVisita(id)
  } catch (erro) {
    if (erro instanceof ZapleError && erro.status === 404) notFound()
    throw erro
  }

  if (u.papel !== 'gestor' && visita.responsavelId !== u.zapleAgentId) notFound()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <Link href="/kanban" className="text-sm text-slate-600">← Voltar</Link>

      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">{visita.chave}</p>
        <h1 className="text-xl font-semibold">{visita.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">{visita.etapaTitulo}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-slate-500">Cliente</dt>
          <dd className="font-medium">{visita.contatos[0]?.nome ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Responsável</dt>
          <dd className="font-medium">{visita.responsavelNome ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Prazo</dt>
          <dd className={visita.atrasada ? 'font-medium text-red-600' : 'font-medium'}>
            {formatarData(visita.prazo)}{visita.atrasada && ' · atrasada'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Criada em</dt>
          <dd className="font-medium">{formatarData(visita.criadaEm)}</dd>
        </div>
      </dl>

      {visita.descricao && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-500">Observações</h2>
          <p className="whitespace-pre-wrap text-sm">{visita.descricao}</p>
        </section>
      )}

      {/* O botão "Registrar visita" chega na Fatia 2, junto com o checklist. */}
    </div>
  )
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/visita-detalhe.test.ts`
Expected: PASS — 3 testes

- [ ] **Step 6: Commit**

```bash
git add src/app tests/api/visita-detalhe.test.ts
git commit -m "feat(visita): tela de detalhe com controle de acesso"
```

---

## Task 13: Criar visita

**Files:**
- Create: `src/app/(app)/visita/nova/page.tsx`, `src/app/(app)/visita/nova/FormNovaVisita.tsx`
- Create: `src/app/api/contatos/route.ts`
- Modify: `src/app/api/visitas/route.ts` — acrescentar `POST`
- Test: `tests/api/criar-visita.test.ts`

**Interfaces:**
- Consumes: `criarVisita` (Task 4); `buscarContatosPorNome`, `buscarContatoPorTelefone`, `criarContato` (Task 5); `listarEtapas` (Task 3); `exigirUsuario` (Task 7)
- Produces:
  - `GET /api/contatos?busca=` → `{ contatos: Contato[] }`
  - `POST /api/contatos` `{ nome, telefone }` → 201 `{ contato }`
  - `POST /api/visitas` `{ titulo, contatoId, prazo?, responsavelId? }` → 201 `{ visita }`

- [ ] **Step 1: Escrever o teste**

`tests/api/criar-visita.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exigirUsuario = vi.fn()
const criarVisita = vi.fn()
const listarEtapas = vi.fn()
vi.mock('@/lib/auth/atual', () => ({ exigirUsuario, exigirGestor: vi.fn(), usuarioAtual: vi.fn() }))
vi.mock('@/lib/zaple/visitas', () => ({ criarVisita, listarVisitas: vi.fn() }))
vi.mock('@/lib/zaple/painel', () => ({ listarEtapas, painelId: () => 'p1' }))

const ETAPAS = [
  { id: 'e1', titulo: 'Prospecção', posicao: 1, inicial: true, final: false },
  { id: 'e2', titulo: 'Visita', posicao: 2, inicial: false, final: false },
]

function pedido(corpo: unknown) {
  return new Request('http://local/api/visitas', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/visitas', () => {
  beforeEach(() => {
    vi.resetModules()
    exigirUsuario.mockResolvedValue({ id: 'u1', papel: 'vendedor', zapleAgentId: 'agente-1' })
    listarEtapas.mockResolvedValue(ETAPAS)
    criarVisita.mockReset()
    criarVisita.mockResolvedValue({ id: 'v1' })
  })

  it('cria na etapa inicial, com o próprio vendedor como responsável', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(pedido({ titulo: 'Padaria do Zé', contatoId: 'c1' }))

    expect(r.status).toBe(201)
    expect(criarVisita).toHaveBeenCalledWith({
      etapaId: 'e1',
      titulo: 'Padaria do Zé',
      responsavelId: 'agente-1',
      contatoIds: ['c1'],
      prazo: undefined,
    })
  })

  it('vendedor não consegue atribuir a visita a outra pessoa', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    await POST(pedido({ titulo: 'X', contatoId: 'c1', responsavelId: 'agente-outro' }))

    expect(criarVisita).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-1' }))
  })

  it('gestor pode atribuir a visita a outro vendedor', async () => {
    exigirUsuario.mockResolvedValue({ id: 'g1', papel: 'gestor', zapleAgentId: 'agente-9' })
    const { POST } = await import('@/app/api/visitas/route')

    await POST(pedido({ titulo: 'X', contatoId: 'c1', responsavelId: 'agente-outro' }))

    expect(criarVisita).toHaveBeenCalledWith(expect.objectContaining({ responsavelId: 'agente-outro' }))
  })

  it('recusa visita sem contato', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    const r = await POST(pedido({ titulo: 'Sem cliente' }))

    expect(r.status).toBe(400)
    expect(criarVisita).not.toHaveBeenCalled()
  })

  it('recusa título vazio', async () => {
    const { POST } = await import('@/app/api/visitas/route')

    expect((await POST(pedido({ titulo: '', contatoId: 'c1' }))).status).toBe(400)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/api/criar-visita.test.ts`
Expected: FAIL — `POST is not a function`

- [ ] **Step 3: Acrescentar o POST à rota de visitas**

Acrescentar ao final de `src/app/api/visitas/route.ts`:

```ts
import { z } from 'zod'
import { criarVisita } from '@/lib/zaple/visitas'
import { listarEtapas } from '@/lib/zaple/painel'

const NovaEntrada = z.object({
  titulo: z.string().min(1).max(500),
  contatoId: z.string().uuid(),
  prazo: z.string().datetime().optional(),
  responsavelId: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  const u = await exigirUsuario()

  const analisado = NovaEntrada.safeParse(await req.json().catch(() => null))
  if (!analisado.success) {
    return Response.json({ erro: 'Informe título e cliente' }, { status: 400 })
  }

  const etapas = await listarEtapas()
  const inicial = etapas.find((e) => e.inicial)
  if (!inicial) return Response.json({ erro: 'Painel sem etapa inicial' }, { status: 500 })

  // Só o gestor atribui visita a outra pessoa.
  const responsavelId =
    u.papel === 'gestor' && analisado.data.responsavelId
      ? analisado.data.responsavelId
      : u.zapleAgentId

  const visita = await criarVisita({
    etapaId: inicial.id,
    titulo: analisado.data.titulo,
    responsavelId,
    contatoIds: [analisado.data.contatoId],
    prazo: analisado.data.prazo,
  })

  return Response.json({ visita }, { status: 201 })
}
```

- [ ] **Step 4: Rota de contatos**

`src/app/api/contatos/route.ts`:

```ts
import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarContatoPorTelefone, buscarContatosPorNome, criarContato } from '@/lib/zaple/contatos'

export async function GET(req: Request) {
  await exigirUsuario()
  const busca = new URL(req.url).searchParams.get('busca')?.trim() ?? ''
  if (busca.length < 2) return Response.json({ contatos: [] })

  // Se o que foi digitado parece um telefone, a busca exata é mais útil e
  // mais barata do que varrer nomes.
  const soDigitos = busca.replace(/\D/g, '')
  if (soDigitos.length >= 10) {
    const achado = await buscarContatoPorTelefone(soDigitos)
    return Response.json({ contatos: achado ? [achado] : [] })
  }

  return Response.json({ contatos: await buscarContatosPorNome(busca) })
}

const NovoContato = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(10),
})

export async function POST(req: Request) {
  await exigirUsuario()

  const analisado = NovoContato.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return Response.json({ erro: 'Informe nome e telefone' }, { status: 400 })

  const jaExiste = await buscarContatoPorTelefone(analisado.data.telefone)
  if (jaExiste) return Response.json({ contato: jaExiste }, { status: 200 })

  return Response.json({ contato: await criarContato(analisado.data) }, { status: 201 })
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run tests/api/criar-visita.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 6: Tela de nova visita**

`src/app/(app)/visita/nova/FormNovaVisita.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Contato } from '@/lib/zaple/tipos'

export function FormNovaVisita() {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Contato[]>([])
  const [escolhido, setEscolhido] = useState<Contato | null>(null)
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function procurar() {
    if (busca.trim().length < 2) return
    setOcupado(true)
    setErro(null)
    const r = await fetch(`/api/contatos?busca=${encodeURIComponent(busca)}`)
    setOcupado(false)
    if (!r.ok) { setErro('Não foi possível buscar clientes'); return }
    setAchados((await r.json()).contatos)
  }

  async function cadastrarContato() {
    setOcupado(true)
    setErro(null)
    const r = await fetch('/api/contatos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: busca, telefone: prompt('Telefone do cliente:') ?? '' }),
    })
    setOcupado(false)
    if (!r.ok) { setErro((await r.json()).erro ?? 'Não foi possível cadastrar o cliente'); return }
    const { contato } = await r.json()
    setEscolhido(contato)
    setTitulo((t) => t || contato.nome)
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (!escolhido) { setErro('Escolha o cliente da visita'); return }
    setOcupado(true)
    setErro(null)

    const r = await fetch('/api/visitas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        titulo,
        contatoId: escolhido.id,
        prazo: prazo ? new Date(prazo + 'T12:00:00').toISOString() : undefined,
      }),
    })

    setOcupado(false)
    if (!r.ok) { setErro((await r.json()).erro ?? 'Não foi possível criar a visita'); return }
    router.replace('/kanban')
    router.refresh()
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">Cliente</label>

        {escolhido ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-300 px-4 py-3">
            <div>
              <p className="font-medium">{escolhido.nome}</p>
              <p className="text-sm text-slate-500">{escolhido.telefone}</p>
            </div>
            <button type="button" onClick={() => setEscolhido(null)} className="text-sm text-slate-600 underline">
              trocar
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome ou telefone"
                className="flex-1 rounded-lg border border-slate-300 px-4 py-3"
              />
              <button type="button" onClick={procurar} disabled={ocupado} className="rounded-lg border border-slate-300 px-4">
                Buscar
              </button>
            </div>

            {achados.length > 0 && (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {achados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { setEscolhido(c); setTitulo((t) => t || c.nome) }}
                      className="w-full px-4 py-3 text-left"
                    >
                      <span className="font-medium">{c.nome}</span>
                      <span className="block text-sm text-slate-500">{c.telefone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {busca.trim().length >= 2 && achados.length === 0 && (
              <button type="button" onClick={cadastrarContato} disabled={ocupado} className="text-sm text-slate-600 underline">
                Cadastrar &ldquo;{busca}&rdquo; como novo cliente
              </button>
            )}
          </>
        )}
      </section>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Título da visita</span>
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Prazo (opcional)</span>
        <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded-lg border border-slate-300 px-4 py-3" />
      </label>

      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}

      <button disabled={ocupado} className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50">
        {ocupado ? 'Salvando…' : 'Criar visita'}
      </button>
    </form>
  )
}
```

`src/app/(app)/visita/nova/page.tsx`:

```tsx
import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { FormNovaVisita } from './FormNovaVisita'

export default async function NovaVisita() {
  await exigirUsuario()

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-4">
      <Link href="/kanban" className="text-sm text-slate-600">← Voltar</Link>
      <h1 className="text-xl font-semibold">Nova visita</h1>
      <FormNovaVisita />
    </div>
  )
}
```

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — todos os testes das Tasks 1 a 13

- [ ] **Step 8: Conferir o caminho completo no navegador**

Run: `npm run dev`

Percorrer: entrar → `/kanban` vazio → *Nova visita* → buscar um contato real → criar → o card aparece em Prospecção → *Avançar para Visita* → o card muda de coluna. Abrir o painel no Zaple e confirmar que o card está lá, com responsável e contato preenchidos.

- [ ] **Step 9: Commit**

```bash
git add src/app tests/api
git commit -m "feat(visita): criação de visita com busca e cadastro de cliente"
```

---

## Task 14: Arrastar cards no desktop

**Files:**
- Modify: `src/app/(app)/kanban/Quadro.tsx`
- Create: `src/app/(app)/kanban/QuadroDesktop.tsx`

**Interfaces:**
- Consumes: `podeMover` (Task 10); `POST /api/visitas/[id]/mover` (Task 11)
- Produces: nenhuma interface nova — apenas comportamento adicional em telas largas

- [ ] **Step 1: Instalar o dnd-kit**

```bash
npm install @dnd-kit/core
```

- [ ] **Step 2: Criar o quadro de colunas**

`src/app/(app)/kanban/QuadroDesktop.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import type { Etapa, Visita } from '@/lib/zaple/tipos'
import { podeMover } from '@/lib/visita/regras'

function CartaoArrastavel({ visita }: { visita: Visita }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: visita.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${isDragging ? 'opacity-50' : ''}`}
    >
      <Link href={`/visita/${visita.id}`} className="font-medium leading-snug">{visita.titulo}</Link>
      <p className="mt-1 text-xs text-slate-500">
        {visita.chave}{visita.contatos[0] && ` · ${visita.contatos[0].nome}`}
      </p>
    </div>
  )
}

function Coluna({ etapa, visitas }: { etapa: Etapa; visitas: Visita[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id })

  return (
    <section
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-lg p-3 ${isOver ? 'bg-slate-200' : 'bg-slate-100'}`}
    >
      <h2 className="text-sm font-medium text-slate-700">{etapa.titulo} ({visitas.length})</h2>
      {visitas.map((v) => <CartaoArrastavel key={v.id} visita={v} />)}
    </section>
  )
}

export function QuadroDesktop({ etapas, visitas }: { etapas: Etapa[]; visitas: Visita[] }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)

  async function aoSoltar(evento: DragEndEvent) {
    const destinoId = evento.over?.id
    if (typeof destinoId !== 'string') return

    const visita = visitas.find((v) => v.id === evento.active.id)
    if (!visita || !podeMover(etapas, visita.etapaId, destinoId)) return

    setErro(null)
    const r = await fetch(`/api/visitas/${visita.id}/mover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ etapaId: destinoId, etapaAtualId: visita.etapaId }),
    })

    if (!r.ok) {
      setErro((await r.json()).erro ?? 'Não foi possível mover a visita')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {erro && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <DndContext onDragEnd={aoSoltar}>
        <div className="flex gap-4 overflow-x-auto">
          {etapas.map((e) => (
            <Coluna key={e.id} etapa={e} visitas={visitas.filter((v) => v.etapaId === e.id)} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
```

- [ ] **Step 3: Escolher o quadro pelo tamanho da tela**

Em `src/app/(app)/kanban/page.tsx`, trocar o retorno por:

```tsx
  return (
    <>
      <div className="lg:hidden">
        <Quadro
          etapas={etapas}
          visitas={pagina.itens}
          podeVerTodos={u.papel === 'gestor'}
          vendoTodos={vendoTodos}
        />
      </div>
      <div className="hidden lg:block">
        <QuadroDesktop etapas={etapas} visitas={pagina.itens} />
      </div>
    </>
  )
```

Acrescentar o import: `import { QuadroDesktop } from './QuadroDesktop'`

> Escolha deliberada: renderizar os dois e esconder por CSS, em vez de detectar a largura em JavaScript. Detecção por JS causa um salto visível no primeiro render, e este é o app que o vendedor abre vinte vezes por dia.

- [ ] **Step 4: Conferir no navegador**

Run: `npm run dev`
Numa janela larga, arrastar um card de Prospecção para Visita e confirmar que ele fica na coluna nova depois do refresh. Estreitar a janela e confirmar que o quadro por etapa reaparece.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/kanban
git commit -m "feat(kanban): arrastar cards entre colunas no desktop"
```

---

## Encerramento da Fatia 1

Ao fim da Task 14 o vendedor entra pelo celular, vê as visitas dele, cria visita vinculada a um cliente real do Zaple e move o card entre as quatro etapas — e tudo aparece igual para quem abrir o painel no Zaple.

**Verificação final antes de considerar a fatia pronta:**

```bash
npm test
npm run build
```

Depois, no navegador: instalar o PWA pela opção "Adicionar à tela inicial", fechar o Chrome e abrir pelo ícone — deve abrir em tela cheia, sem barra de endereço.

**Próximo:** plano da Fatia 2 (checklist, relatório, rascunho e fila offline, `visita_resposta`), que acrescenta o botão *Registrar visita* deixado como comentário na Task 12.

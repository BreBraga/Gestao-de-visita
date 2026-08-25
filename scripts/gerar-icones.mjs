// Gera os ícones do PWA sem depender de biblioteca de imagem.
// Fundo #0b1220 preenchendo o quadrado inteiro (exigência de ícone maskable:
// o Android recorta as bordas, então o desenho fica na zona segura central)
// e um "V" branco desenhado por distância até o segmento, o que dá as bordas
// suavizadas de graça.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const FUNDO = [0x0b, 0x12, 0x20]
const TRACO = [0xff, 0xff, 0xff]

const tabelaCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = tabelaCrc[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tamanho, corpo, crc])
}

function png(largura, altura, rgba) {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const linhas = Buffer.alloc(altura * (1 + largura * 4))
  for (let y = 0; y < altura; y++) {
    const inicio = y * (1 + largura * 4)
    linhas[inicio] = 0 // filtro "none"
    rgba.copy(linhas, inicio + 1, y * largura * 4, (y + 1) * largura * 4)
  }
  return Buffer.concat([
    assinatura,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Menor distância do ponto (px,py) ao segmento (ax,ay)-(bx,by). */
function distanciaAoSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const comprimento = dx * dx + dy * dy
  let t = comprimento === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / comprimento
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function desenhar(tamanho) {
  const rgba = Buffer.alloc(tamanho * tamanho * 4)
  const s = tamanho

  // Zona segura do ícone maskable: o "V" cabe no círculo central de 80%.
  const topoEsq = [0.33 * s, 0.34 * s]
  const base = [0.5 * s, 0.68 * s]
  const topoDir = [0.67 * s, 0.34 * s]
  const meiaEspessura = 0.055 * s

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5
      const py = y + 0.5

      const d = Math.min(
        distanciaAoSegmento(px, py, topoEsq[0], topoEsq[1], base[0], base[1]),
        distanciaAoSegmento(px, py, base[0], base[1], topoDir[0], topoDir[1])
      )

      // Faixa de 1px entre "dentro" e "fora" vira a suavização da borda.
      const cobertura = Math.max(0, Math.min(1, meiaEspessura + 0.5 - d))

      const i = (y * s + x) * 4
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round(FUNDO[c] + (TRACO[c] - FUNDO[c]) * cobertura)
      }
      rgba[i + 3] = 255
    }
  }

  return png(s, s, rgba)
}

mkdirSync('public', { recursive: true })
for (const tamanho of [192, 512]) {
  const arquivo = `public/icone-${tamanho}.png`
  writeFileSync(arquivo, desenhar(tamanho))
  console.log('gerado', arquivo)
}

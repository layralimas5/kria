import { useId, type ReactNode } from 'react'
import type { TraitGroupId } from '@/domain/personaTraits'

// Ilustração de cada opção visual do construtor: o mesmo manequim de argila,
// mudando só a característica. Fica no lugar enquanto as fotos geradas
// (`npm run traits:images`) não existem. viewBox 120×120.

interface Palette {
  readonly clay: string
  readonly hair: string
  readonly sheen: string
}

const HEAD_PATHS: Record<string, string> = {
  oval: 'M60 30 C71 30 77 40 77 52 C77 66 70 75 60 75 C50 75 43 66 43 52 C43 40 49 30 60 30 Z',
  alongado: 'M60 26 C70 26 75 38 75 52 C75 68 69 79 60 79 C51 79 45 68 45 52 C45 38 50 26 60 26 Z',
  quadrado: 'M60 30 C73 30 77 37 77 46 L77 62 C77 70 71 75 60 75 C49 75 43 70 43 62 L43 46 C43 37 47 30 60 30 Z',
  redondo: 'M60 31 C72 31 79 40 79 53 C79 66 71 74 60 74 C49 74 41 66 41 53 C41 40 48 31 60 31 Z',
  coracao: 'M60 30 C73 30 79 38 78 48 C77 60 68 72 60 76 C52 72 43 60 42 48 C41 38 47 30 60 30 Z',
  largo: 'M60 31 C74 31 81 39 81 50 C81 64 72 74 60 74 C48 74 39 64 39 50 C39 39 46 31 60 31 Z',
}

/** Rosto neutro de manequim: só volume, sem identidade. */
function Bust({ palette, shape = 'oval', children }: { palette: Palette; shape?: string; children?: ReactNode }) {
  const head = HEAD_PATHS[shape] ?? HEAD_PATHS.oval
  return (
    <>
      <path d="M14 120 C16 100 34 89 60 89 C86 89 104 100 106 120 Z" fill={palette.clay} />
      <path d="M14 120 C16 100 34 89 60 89 C86 89 104 100 106 120 Z" fill={palette.sheen} />
      <path d="M53 68 L53 88 Q60 93 67 88 L67 68 Z" fill={palette.clay} />
      <path d="M53 76 Q60 82 67 76 L67 88 Q60 93 53 88 Z" fill="#000" opacity=".25" />
      <ellipse cx="43.5" cy="54" rx="2.6" ry="4.5" fill={palette.clay} />
      <ellipse cx="76.5" cy="54" rx="2.6" ry="4.5" fill={palette.clay} />
      <path d={head} fill={palette.clay} />
      <path d={head} fill={palette.sheen} />
      <g fill="none" stroke="#14161a" strokeLinecap="round" opacity=".5">
        <path d="M51 47 Q54.5 45.4 58 46.8" strokeWidth="1.3" />
        <path d="M62 46.8 Q65.5 45.4 69 47" strokeWidth="1.3" />
        <path d="M60 52 L58.6 59 Q60 60.6 61.4 59" strokeWidth="1" />
        <path d="M55.5 65 Q60 66.8 64.5 65" strokeWidth="1.1" />
      </g>
      <ellipse cx="54.5" cy="51" rx="2.6" ry="1.3" fill="#14161a" opacity=".5" />
      <ellipse cx="65.5" cy="51" rx="2.6" ry="1.3" fill="#14161a" opacity=".5" />
      {children}
    </>
  )
}

const CAP = 'M42 50 C41 33 49 26 60 26 C71 26 79 33 78 50 C75 40 69 35 60 35 C51 35 45 40 42 50 Z'
const TIGHT_CAP = 'M42.5 49 C42 33 50 27.5 60 27.5 C70 27.5 78 33 77.5 49 C74 39 68 34 60 34 C52 34 46 39 42.5 49 Z'

function circles(points: readonly (readonly [number, number])[], r: number, fill: string) {
  return points.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={fill} />)
}

/** Pontos ao longo do contorno de cima da cabeça, para cachos e crespo. */
function crown(radius: number, from: number, to: number, step: number): (readonly [number, number])[] {
  const points: (readonly [number, number])[] = []
  for (let angle = from; angle <= to; angle += step) {
    const radians = (angle * Math.PI) / 180
    points.push([+(60 + radius * Math.cos(radians)).toFixed(1), +(50 + radius * 1.12 * Math.sin(radians)).toFixed(1)])
  }
  return points
}

function braids(fill: string) {
  return [44, 48.5, 71.5, 76].flatMap((x) =>
    Array.from({ length: 9 }, (_, index) => <ellipse key={`${x}-${index}`} cx={x} cy={52 + index * 6.4} rx="2.5" ry="3.4" fill={fill} />),
  )
}

function hairLayers(style: string, hair: string): { back?: ReactNode; front?: ReactNode } {
  switch (style) {
    case 'liso-longo':
      return {
        back: <path d="M41 48 C39 32 48 25 60 25 C72 25 81 32 79 48 L82 106 L38 106 Z" fill={hair} />,
        front: (
          <>
            <path d={CAP} fill={hair} />
            <path d="M42 46 C40 64 42 84 41 106 L48 106 C46 84 46 64 46 52 Z" fill={hair} />
            <path d="M78 46 C80 64 78 84 79 106 L72 106 C74 84 74 64 74 52 Z" fill={hair} />
          </>
        ),
      }
    case 'ondulado':
      return {
        back: (
          <path
            d="M41 48 C39 32 48 25 60 25 C72 25 81 32 79 48 C83 58 78 66 82 74 C78 80 74 82 70 84 L50 84 C46 82 42 80 38 74 C42 66 37 58 41 48 Z"
            fill={hair}
          />
        ),
        front: (
          <>
            <path d={CAP} fill={hair} />
            <path d="M42 46 C38 56 45 62 40 70 C42 77 46 80 49 82 L50 78 C46 72 49 64 46 56 Z" fill={hair} />
            <path d="M78 46 C82 56 75 62 80 70 C78 77 74 80 71 82 L70 78 C74 72 71 64 74 56 Z" fill={hair} />
          </>
        ),
      }
    case 'cacheado':
      return {
        back: <>{circles([[41, 40], [39, 52], [41, 64], [45, 74], [79, 40], [81, 52], [79, 64], [75, 74], [47, 28], [60, 23], [73, 28]], 7.5, hair)}</>,
        front: <>{circles([[46, 34], [53, 29.5], [60, 28], [67, 29.5], [74, 34]], 6, hair)}</>,
      }
    case 'crespo':
      return { front: <>{circles([...crown(19, 190, 350, 13), ...crown(15, 205, 335, 16)], 3.6, hair)}</> }
    case 'black-power':
      return {
        back: <circle cx="60" cy="45" r="31" fill={hair} />,
        front: <path d="M43 46 C44 36 51 33 60 33 C69 33 76 36 77 46 C74 40 68 38 60 38 C52 38 46 40 43 46 Z" fill={hair} />,
      }
    case 'trancas':
      return {
        back: <path d="M42 48 C40 32 49 25 60 25 C71 25 80 32 78 48 L80 106 L40 106 Z" fill={hair} opacity=".9" />,
        front: (
          <>
            <path d={CAP} fill={hair} />
            {braids(hair)}
          </>
        ),
      }
    case 'coque':
      return {
        back: <circle cx="60" cy="22" r="9.5" fill={hair} />,
        front: (
          <>
            <path d={TIGHT_CAP} fill={hair} />
            <circle cx="60" cy="22" r="9.5" fill={hair} />
          </>
        ),
      }
    case 'rabo':
      return {
        back: <path d="M71 29 C87 29 92 46 88 62 C86 74 82 84 77 94 C80 80 81 66 79 54 C78 44 75 36 69 33 Z" fill={hair} />,
        front: (
          <>
            <path d={TIGHT_CAP} fill={hair} />
            <ellipse cx="73" cy="31" rx="3.2" ry="2.4" fill="#ff6b2c" />
          </>
        ),
      }
    case 'chanel':
      return {
        back: <path d="M41 66 C38 36 47 26 60 26 C73 26 82 36 79 66 Z" fill={hair} />,
        front: <path d="M41 67 C38 34 48 25 60 25 C72 25 82 34 79 67 L73 67 C74 52 72 45 69 43 L51 43 C48 45 46 52 47 67 Z" fill={hair} />,
      }
    case 'curto':
      return {
        front: (
          <path
            d="M42.5 48 C41 32 49 25.5 60 25.5 C71 25.5 79 32 77.5 48 C76 41 72 37.5 66 37 L63 34.5 L60 37 L56.5 34.5 L53 37.3 C48 38.5 44 42 42.5 48 Z"
            fill={hair}
          />
        ),
      }
    case 'raspado':
      return { front: <path d={TIGHT_CAP} fill={hair} opacity=".55" /> }
    case 'careca':
      return { front: <ellipse cx="55" cy="36" rx="7" ry="3" fill="#fff" opacity=".12" /> }
    default:
      return {}
  }
}

const MUSTACHE = 'M53 61.5 C56 59.5 64 59.5 67 61.5 C64 62.8 56 62.8 53 61.5 Z'
const THICK_MUSTACHE = 'M51 62.5 C53 58.5 58 59 60 60.5 C62 59 67 58.5 69 62.5 C66 64.5 62 63 60 62.3 C58 63 54 64.5 51 62.5 Z'

function facialHair(style: string, hair: string): ReactNode {
  switch (style) {
    case 'bigode':
      return <path d={MUSTACHE} fill={hair} />
    case 'bigode-grosso':
      return <path d={THICK_MUSTACHE} fill={hair} />
    case 'cavanhaque':
      return (
        <>
          <path d={MUSTACHE} fill={hair} />
          <path d="M55.5 67.5 C56 72 58 75 60 75.5 C62 75 64 72 64.5 67.5 C62 69 58 69 55.5 67.5 Z" fill={hair} />
        </>
      )
    case 'barba-curta':
      return (
        <g opacity=".6">
          <path d="M43.5 55 C44 67 51 75 60 75.5 C69 75 76 67 76.5 55 C75 64 70 69 64 69.5 L60 70 L56 69.5 C50 69 45 64 43.5 55 Z" fill={hair} />
          <path d={MUSTACHE} fill={hair} />
        </g>
      )
    case 'barba-cheia':
      return (
        <>
          <path d="M42.5 52 C42 70 50 82 60 83 C70 82 78 70 77.5 52 C76 63 71 68 65 68.5 C63 66.5 57 66.5 55 68.5 C49 68 44 63 42.5 52 Z" fill={hair} />
          <path d={THICK_MUSTACHE} fill={hair} />
        </>
      )
    default:
      return null
  }
}

interface BodySpec {
  readonly shoulders: number
  readonly waist: number
  readonly hips: number
  readonly limb: number
  readonly belly?: true
}

const BODIES: Record<string, BodySpec> = {
  magro: { shoulders: 11, waist: 7.5, hips: 9, limb: 2.8 },
  atletico: { shoulders: 15, waist: 9, hips: 10.5, limb: 3.8 },
  medio: { shoulders: 13.5, waist: 11, hips: 11.5, limb: 3.8 },
  curvilineo: { shoulders: 12, waist: 8.5, hips: 15, limb: 4.2 },
  plus: { shoulders: 15.5, waist: 16, hips: 17, limb: 5.4, belly: true },
  musculoso: { shoulders: 20, waist: 10, hips: 12, limb: 6 },
}

function Body({ spec, palette }: { spec: BodySpec; palette: Palette }) {
  const { shoulders: s, waist: w, hips: h, limb } = spec
  const torso = `M${60 - s} 27 Q60 22 ${60 + s} 27 L${60 + w} 56 Q${60 + h} 61 ${60 + h} 68 L${60 - h} 68 Q${60 - h} 61 ${60 - w} 56 Z`
  return (
    <>
      {[-1, 1].map((side) => (
        <g key={side} stroke={palette.clay} strokeLinecap="round">
          <line x1={60 + side * (s - 1)} y1="29" x2={60 + side * (s + 5)} y2="64" strokeWidth={limb * 1.5} />
          <line x1={60 + side * h * 0.5} y1="68" x2={60 + side * h * 0.42} y2="110" strokeWidth={limb * 2} />
        </g>
      ))}
      <circle cx="60" cy="13" r="6.5" fill={palette.clay} />
      <path d="M57 18 L57 25 Q60 26.5 63 25 L63 18 Z" fill={palette.clay} />
      <path d={torso} fill={palette.clay} />
      <path d={torso} fill={palette.sheen} />
      {spec.belly && <ellipse cx="60" cy="54" rx={w - 2} ry="9" fill={palette.clay} />}
      <path d={`M${60 - h} 63 L${60 + h} 63 L${60 + h * 0.85} 71 L60 74 L${60 - h * 0.85} 71 Z`} fill="#ececec" />
    </>
  )
}

function Garment({ d, color, sheen }: { d: string; color: string; sheen: string }) {
  return (
    <>
      <path d={d} fill={color} />
      <path d={d} fill={sheen} />
    </>
  )
}

const SHAPES = {
  tee: 'M40 20 L51 16 Q60 22 69 16 L80 20 L90 34 L81 39 L78 33 L78 62 L42 62 L42 33 L39 39 L30 34 Z',
  longSleeve: 'M40 20 L51 16 Q60 22 69 16 L80 20 L88 63 L80 64 L77 34 L77 64 L43 64 L43 34 L40 64 L32 63 Z',
  hoodie: 'M38 20 L50 15 Q60 24 70 15 L82 20 L90 65 L81 66 L79 36 L79 67 L41 67 L41 36 L39 66 L30 65 Z',
  crop: 'M43 22 L52 18 Q60 23 68 18 L77 22 L84 32 L77 35 L75 31 L75 50 L45 50 L45 31 L43 35 L36 32 Z',
  jeans: 'M42 62 L78 62 L80 108 L63 108 L60 78 L57 108 L40 108 Z',
  cargo: 'M40 65 L80 65 L84 108 L64 108 L60 80 L56 108 L36 108 Z',
  baggy: 'M42 56 L78 56 L86 108 L63 108 L60 82 L57 108 L34 108 Z',
  longDress: 'M48 16 Q60 22 72 16 L77 19 L88 60 L81 62 L75 36 L86 110 L34 110 L45 36 L39 62 L32 60 L43 19 Z',
  tunic: 'M46 16 Q60 24 74 16 L86 34 L78 40 L76 34 L82 100 Q60 106 38 100 L44 34 L42 40 L34 34 Z',
}

function Shoes({ color, chunky = false }: { color: string; chunky?: boolean }) {
  const height = chunky ? 7 : 5
  return (
    <>
      <rect x="38" y="108" width="19" height={height} rx="2.5" fill={color} />
      <rect x="63" y="108" width="19" height={height} rx="2.5" fill={color} />
    </>
  )
}

function Outfit({ value, sheen }: { value: string; sheen: string }) {
  switch (value) {
    case 'casual':
      return (
        <>
          <Garment d={SHAPES.jeans} color="#3b5f8f" sheen={sheen} />
          <path d="M60 64 L60 78" stroke="#2a4468" strokeWidth="1" />
          <Garment d={SHAPES.tee} color="#efefea" sheen={sheen} />
          <Shoes color="#f2f2f2" />
        </>
      )
    case 'streetwear':
      return (
        <>
          <Garment d={SHAPES.cargo} color="#5f6366" sheen={sheen} />
          <rect x="38" y="82" width="9" height="10" rx="1.5" fill="#53575a" />
          <rect x="73" y="82" width="9" height="10" rx="1.5" fill="#53575a" />
          <Garment d={SHAPES.hoodie} color="#2f6b45" sheen={sheen} />
          <path d="M48 16 Q60 4 72 16 Q60 27 48 16 Z" fill="#285c3b" />
          <rect x="49" y="48" width="22" height="10" rx="3" fill="#285c3b" />
          <Shoes color="#e8e8e8" chunky />
        </>
      )
    case 'elegante':
      return (
        <>
          <Garment d={SHAPES.longDress} color="#7a1f35" sheen={sheen} />
          <path d="M45 36 Q60 40 75 36" stroke="#5c1527" strokeWidth="1.5" fill="none" />
          <Shoes color="#141414" />
        </>
      )
    case 'esportivo':
      return (
        <>
          <Garment d={SHAPES.jeans} color="#1f2c5a" sheen={sheen} />
          <path d="M41.5 66 L40.3 107 M78.5 66 L79.7 107" stroke="#f2f2f2" strokeWidth="1.6" />
          <Garment d={SHAPES.longSleeve} color="#1f2c5a" sheen={sheen} />
          <path d="M41 24 L33 62 M79 24 L87 62" stroke="#f2f2f2" strokeWidth="1.6" />
          <path d="M60 22 L60 64" stroke="#c9ccd4" strokeWidth="1" />
          <Shoes color="#f2f2f2" />
        </>
      )
    case 'boho':
      return (
        <>
          <Garment d={SHAPES.tunic} color="#d8c09a" sheen={sheen} />
          {circles([[50, 50], [60, 56], [70, 50], [48, 72], [60, 78], [72, 72], [54, 92], [66, 92]], 1.8, '#a8744f')}
          <path d="M44 40 Q60 44 76 40" stroke="#8a5a3b" strokeWidth="1.8" fill="none" />
          <Shoes color="#8a5a3b" />
        </>
      )
    case 'minimalista':
      return (
        <>
          <Garment d={SHAPES.jeans} color="#ece5d9" sheen={sheen} />
          <Garment d={SHAPES.longSleeve} color="#c9b89e" sheen={sheen} />
          <path d="M43 61 L77 61 M32.5 60 L40 61 M80 61 L87.5 60" stroke="#b3a286" strokeWidth="2" />
          <Shoes color="#3a2e26" />
        </>
      )
    case 'y2k':
      return (
        <>
          <Garment d={SHAPES.baggy} color="#8fb3d9" sheen={sheen} />
          <path d="M42 59 L78 59" stroke="#c9a14a" strokeWidth="1.6" />
          <Garment d={SHAPES.crop} color="#f29bc4" sheen={sheen} />
          <path d="M55 30 L65 30" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
          <Shoes color="#f4f4f4" chunky />
        </>
      )
    case 'executivo':
      return (
        <>
          <Garment d={SHAPES.jeans} color="#1f2a44" sheen={sheen} />
          <Garment d={SHAPES.longSleeve} color="#1f2a44" sheen={sheen} />
          <path d="M51 16 L60 40 L69 16 Q60 21 51 16 Z" fill="#f4f4f4" />
          <path d="M58.6 20 L61.4 20 L62.4 37 L60 41 L57.6 37 Z" fill="#8a1f2b" />
          <path d="M51 16 L58 44 M69 16 L62 44" stroke="#131a2c" strokeWidth="1.6" fill="none" />
          <circle cx="60" cy="52" r="1.2" fill="#131a2c" />
          <Shoes color="#141414" />
        </>
      )
    default:
      return null
  }
}

/** Grupos que têm ilustração. Os outros mostram ícone ou cor. */
export const ART_GROUPS: ReadonlySet<TraitGroupId> = new Set(['hairstyle', 'faceShape', 'facialHair', 'build', 'outfit'])

/** Enquadramento de cada tipo: rosto bem perto, corpo e roupa inteiros. */
const VIEW_BOXES: Partial<Record<TraitGroupId, string>> = {
  hairstyle: '14 12 92 92',
  faceShape: '20 18 80 80',
  facialHair: '20 18 80 80',
  build: '6 2 108 108',
  outfit: '6 4 108 108',
}

interface TraitArtProps {
  readonly group: TraitGroupId
  readonly value: string
  /** Cor do cabelo escolhida, para os cortes e a barba aparecerem nela. */
  readonly hairTint?: string
  readonly className?: string
}

export function TraitArt({ group, value, hairTint, className }: TraitArtProps) {
  const id = useId().replace(/:/g, '')
  const palette: Palette = { clay: `url(#clay-${id})`, hair: `url(#hair-${id})`, sheen: `url(#sheen-${id})` }

  let content: ReactNode = null
  if (group === 'hairstyle') {
    const layers = hairLayers(value, palette.hair)
    content = (
      <>
        {layers.back}
        <Bust palette={palette}>{layers.front}</Bust>
      </>
    )
  } else if (group === 'faceShape') {
    content = <Bust palette={palette} shape={value} />
  } else if (group === 'facialHair') {
    content = (
      <Bust palette={palette}>
        {hairLayers('curto', palette.hair).front}
        {facialHair(value, palette.hair)}
      </Bust>
    )
  } else if (group === 'build') {
    content = <Body spec={BODIES[value] ?? BODIES.medio!} palette={palette} />
  } else if (group === 'outfit') {
    content = <Outfit value={value} sheen={palette.sheen} />
  }

  return (
    <svg viewBox={VIEW_BOXES[group] ?? '0 0 120 120'} className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`bg-${id}`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#24272c" />
          <stop offset="1" stopColor="#111316" />
        </radialGradient>
        <linearGradient id={`clay-${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#7d828a" />
          <stop offset="1" stopColor="#3a3e45" />
        </linearGradient>
        <linearGradient id={`hair-${id}`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={hairTint ?? '#4a362c'} />
          <stop offset="0.6" stopColor={hairTint ?? '#2e221c'} />
          <stop offset="1" stopColor="#140e0c" />
        </linearGradient>
        <linearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
      </defs>
      <rect x="-20" y="-20" width="160" height="160" fill={`url(#bg-${id})`} />
      {content}
    </svg>
  )
}

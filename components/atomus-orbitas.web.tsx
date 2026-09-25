import { createElement, useState } from 'react';

// Versão WEB do logo animado: só transforms CSS (a animação roda fora do thread do JS, sem engasgar enquanto o app carrega).
// Mesma estrutura do que o public/index.html mostra antes do React montar; o atraso da animação compensa o tempo desde
// então (window.__orbT0), então a troca do HTML para o React não dá "pulo".
const RX = 105;
const RY = 37;
const K = RY / RX;
const COR = '#1c1c1e';
const ORBITAS = [0, 90, 45, 135];
const BOLINHAS = [
  { rot: 0, periodo: 4, fase: 0.25 },
  { rot: 90, periodo: 5, fase: 0.6 },
  { rot: 45, periodo: 6, fase: 0.1 },
  { rot: 45, periodo: 6, fase: 0.6 },
  { rot: 135, periodo: 5, fase: 0.35 },
  { rot: 135, periodo: 5, fase: 0.85 },
];

const zero: any = { position: 'absolute', width: 0, height: 0 };

export function AtomusOrbitas({ size = 260, traco = 4 }: { size?: number; traco?: number }) {
  // Calculado uma vez: se mudasse a cada render, a animação reiniciaria.
  const [decorrido] = useState(() => {
    const t0 = typeof window !== 'undefined' ? (window as any).__orbT0 : undefined;
    return typeof t0 === 'number' ? Math.max(0, (performance.now() - t0) / 1000) : 0;
  });

  const el = createElement as any;
  return el(
    'div',
    { style: { position: 'relative', width: size, height: size, flexShrink: 0 } },
    el(
      'div',
      { style: { position: 'absolute', left: 0, top: 0, width: 260, height: 260, transformOrigin: '0 0', transform: `scale(${size / 260})` } },
      ...ORBITAS.map((rot) =>
        el(
          'div',
          { key: 'o' + rot, style: { ...zero, left: 130, top: 130, transform: `rotate(${rot}deg)` } },
          el('div', { style: { position: 'absolute', left: -RX, top: -RY, width: RX * 2, height: RY * 2, boxSizing: 'border-box', border: `${traco}px solid ${COR}`, borderRadius: '50%' } })
        )
      ),
      ...BOLINHAS.map((b, i) =>
        el(
          'div',
          { key: 'b' + i, style: { ...zero, left: 130, top: 130, transform: `rotate(${b.rot}deg)` } },
          el(
            'div',
            { style: { ...zero, left: 0, top: 0, transform: `scaleY(${K})` } },
            el(
              'div',
              { style: { ...zero, left: 0, top: 0, transformOrigin: '0 0', animation: `orb-spin ${b.periodo}s linear infinite`, animationDelay: `-${(b.fase * b.periodo + decorrido).toFixed(3)}s` } },
              // Contra-rotação: cancela a rotação do braço para a bolinha não deformar com o achatamento da órbita.
              el(
                'div',
                { style: { ...zero, left: RX, top: 0, transformOrigin: '0 0', animation: `orb-spin ${b.periodo}s linear infinite reverse`, animationDelay: `-${(b.fase * b.periodo + decorrido).toFixed(3)}s` } },
                el('div', { style: { position: 'absolute', left: -6.5, top: -6.5, width: 13, height: 13, borderRadius: '50%', background: COR, transform: `scaleY(${1 / K})` } })
              )
            )
          )
        )
      )
    )
  );
}

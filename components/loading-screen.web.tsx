import { createElement } from 'react';
import { theme } from '@/src/theme';
import { AtomusOrbitas } from '@/components/atomus-orbitas';

// Versão WEB da tela de carregamento: o zoom e o sumiço usam CSS transition (rodam fora do thread do JS), então não
// engasgam mesmo com o app montando por baixo ao mesmo tempo.
const DURACAO_ZOOM = 900;

export function LoadingScreen({ saindo = false, aoTerminar }: { saindo?: boolean; aoTerminar?: () => void }) {
  const el = createElement as any;
  return el(
    'div',
    {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: theme.colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: saindo ? 0 : 1,
        transition: `opacity ${DURACAO_ZOOM * 0.45}ms linear ${DURACAO_ZOOM * 0.55}ms`,
        pointerEvents: saindo ? 'none' : 'auto',
        willChange: 'opacity',
      },
      onTransitionEnd: (e: any) => {
        if (saindo && e.propertyName === 'opacity' && aoTerminar) aoTerminar();
      },
    },
    el(
      'div',
      {
        style: {
          transform: saindo ? 'scale(16)' : 'scale(1)',
          transition: `transform ${DURACAO_ZOOM}ms cubic-bezier(0.32, 0, 0.67, 0)`,
          willChange: 'transform',
        },
      },
      el(AtomusOrbitas, null)
    )
  );
}

import { useEffect, useRef, useState } from 'react';
import { useBoxes } from '../../cockpit/useBoxes';
import { enrollThisDevice } from '../../cockpit/sealed-socket';
import { defaultDeviceLabel } from '../../cockpit/device-label';
import { clearEnrollLink, enrollLinkStep, readEnrollLink } from '../../cockpit/enroll-link';
import { linkStore } from '../../cockpit/enroll-link-boot';
import { toast } from '../primitives';
import { useSealState } from './useEnrollDevice';

const ANSWER_MS = 20_000;
const SPENT = 'Este QR já foi usado ou expirou. Gere outro no aparelho já cadastrado.';

function linkError(e: unknown): string {
  const m = (e as Error)?.message ?? '';
  return /inválido|expirado/.test(m) ? SPENT : m || 'não deu certo';
}

// A device opened from a QR link enrolls itself as soon as its socket, bound to
// the link's box, says it needs enrollment. The code is used once and dropped,
// whatever the outcome.
export function useEnrollLink() {
  const seal = useSealState();
  const { boxes, known, active } = useBoxes();
  const [link, setLink] = useState(() => readEnrollLink(linkStore()));
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState('');
  const started = useRef(false);
  const step = enrollLinkStep(link, { seal, active, boxes: known ? boxes.map((b) => b.id) : null, now: Date.now() });

  useEffect(() => {
    if (step === 'idle' || step === 'wait') return;
    const drop = () => { clearEnrollLink(linkStore()); setLink(null); };
    if (step === 'done') { drop(); return; }
    if (step === 'expired') { drop(); setErr(SPENT); return; }
    if (step === 'wrong-box') { drop(); setErr('Este QR é de uma VPS que não está na sua conta.'); return; }
    if (started.current || !link) return;
    started.current = true;
    setWorking(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('A VPS não respondeu. Tente o QR de novo.')), ANSWER_MS);
    });
    Promise.race([enrollThisDevice(link.code, defaultDeviceLabel(), link.box), timeout])
      .then(() => toast('Este aparelho está conectado.', { tone: 'ok' }))
      .catch((e) => setErr(linkError(e)))
      .finally(() => { clearTimeout(timer); drop(); setWorking(false); });
  }, [step, link]);

  return { pending: !!link || working, working, err };
}

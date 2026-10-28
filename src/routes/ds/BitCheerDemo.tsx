import { useState } from 'react';
import { Bit } from '../../components/bit/Bit';
import { Button } from '../../components/primitives';

export function BitCheerDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex items-center gap-4">
      <Bit key={run} state="happy" size={88} />
      <Button size="sm" variant="secondary" onClick={() => setRun((n) => n + 1)}>Repetir</Button>
    </div>
  );
}

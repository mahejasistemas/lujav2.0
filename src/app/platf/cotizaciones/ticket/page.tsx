import { Suspense } from 'react';

import TicketClient from './TicketClient';

export default function TicketPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-600">Cargando...</div>}>
      <TicketClient />
    </Suspense>
  );
}


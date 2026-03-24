import { Suspense } from 'react';

import TicketClient from './TicketClient';

export default function TicketPage() {
  return (
    <Suspense fallback={null}>
      <TicketClient />
    </Suspense>
  );
}


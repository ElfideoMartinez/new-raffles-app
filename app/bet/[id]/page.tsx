// app/bet/[id]/page.tsx

import React, { Suspense } from "react";
import Spinner from "@/app/components/Spinner";
import BetPageClient from "./BetPageClient";

const BetPageServer = async ({ params }: { params: { id: string } }) => {
  return (
    <Suspense
      fallback={
        <div className='flex justify-center items-center mt-5'>
          <Spinner color="var(--color-brand-700)" />
        </div>
      }
    >
      <BetPageClient betId={params.id} />
    </Suspense>
  );
};

export default BetPageServer;
// app/bet/[id]/page.tsx

import React, { Suspense } from "react";
import Spinner from "@/app/components/Spinner";
import BetPageClient from "./BetPageClient";

const BetPageServer = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className='flex justify-center items-center mt-5'>
          <Spinner color="var(--color-brand-700)" />
        </div>
      }
    >
      <BetPageClient betId={id} />
    </Suspense>
  );
};

export default BetPageServer;
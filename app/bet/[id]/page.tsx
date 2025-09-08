// app/bet/[id]/page.tsx

import React, { Suspense } from "react";
import BetPageClient from "./BetPageClient";
import { FadeLoader } from "react-spinners";

const BetPageServer = async ({ params }: { params: { id: string } }) => {
  return (
    <Suspense
      fallback={
        <div className='flex justify-center items-center mt-5'>
          <FadeLoader color='#ffffff' />
        </div>
      }
    >
      <BetPageClient betId={params.id} />
    </Suspense>
  );
};

export default BetPageServer;

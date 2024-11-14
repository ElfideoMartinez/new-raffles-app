import { NextResponse } from "next/server";

export async function POST(request: Request, response: NextResponse) {
  const data = await request.json();
  console.log("Data:", data);

  return NextResponse.json({
    status: 200,
    message: "Hello World",
  });
}

function processTicket(ticket: any) {
  console.log(`Processing raffle ID: ${ticket.raffleId}`);
  ticket.ticketNumbers.forEach((ticketNumber: any) => {
    console.log(`Ticket Number: ${ticketNumber}`);
  });
}

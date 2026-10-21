# Local mock of the raffle Cloud Functions

Dev-only fixture server. **Not shipped to production**: no application code
imports anything from this directory, and it is only ever started manually with
`node mock/server.mjs`. The build picks it up solely through env vars:

```sh
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001/raffleapp-dbc1b/us-central1 \
NEXT_PUBLIC_QUICK_TICKET_BASE_URL=http://127.0.0.1:3001/quick-ticket \
NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3111 \
npx next build
```

Wire shape (easy to get wrong):

- Responses are `{ ok: true, result: … }`; the client does `const { result } = await res.json()`.
- `getAllRaffles` puts the **array** directly in `result` (see `AllRafflesResponse`).
- Fixtures use the raw producer field names (`numberOfTickets`, `awardName`,
  `awardDescription`, `awardImage`, `tickets_left`), not display names; `toRaffle()` normalises them.

It answers only the function names the app calls. It does not implement
business logic, auth, or payments, and ignores `Authorization`.

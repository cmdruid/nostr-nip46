import { Buff }   from '@vbyte/buff'
import { Assert } from '@vbyte/micro-lib/assert'
import { sha256 } from '@vbyte/micro-lib/hash'

import {
  ConnectToken,
  NostrClient,
  SessionManager,
  SimpleSigner
} from '@/index.js'

const name   = 'carol'
const relays = [ 'ws://localhost:8080' ]

const seckey   = sha256(Buff.str(name)).hex
const signer   = new SimpleSigner(seckey)
const client   = new NostrClient(signer)
const sessions = new SessionManager(client)

const invite_str = process.argv[2]

Assert.ok(typeof invite_str === 'string', 'no invite provided')

client.on('request', (req) => {
  console.log('[ carol ] sent request')
  console.dir(req, { depth: null })
})

client.on('response', (res) => {
  console.log('[ carol ] received response')
  console.dir(res, { depth: null })
})

client.on('bounced', (event, err) => {
  console.log('[ carol ] bounced event')
  console.dir(event, { depth: null })
  console.dir(err, { depth: null })
})

client.on('published', (event) => {
  console.log('[ carol ] published event')
  console.dir(event, { depth: null })
})

sessions.on('pending', (session) => {
  console.log('[ sessions ] session pending:', session)
})

sessions.on('activated', (session) => {
  console.log('[ sessions ] session activated:', session)
})

sessions.on('request', (req, session) => {
  console.log('[ sessions ] session request:', req, session)
})

const invite = ConnectToken.decode(invite_str)

await client.subscribe(relays)
await sessions.connect(invite)

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openStore, type Store } from '../src/main/store.ts'

const DAY = 86400
const BASE = 1_762_000_000
const RUNS = Number(process.env.ODY_BENCH_RUNS ?? 25)
const APPS = ['Obsidian', 'Safari', 'Terminal', 'Slack', 'Figma']

interface Case {
  name: string
  budget: number | null
  fill: (store: Store) => void
  expected: number
}

const quantile = (sorted: number[], fraction: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]

const realisticDay = (store: Store) => {
  let at = BASE
  let n = 0
  while (at < BASE + DAY) {
    const app = APPS[n % APPS.length]
    const span = 20 + (n % 180)
    for (let t = at; t < Math.min(at + span, BASE + DAY); t++) {
      store.heartbeat(
        { kind: 'active', app, bundle_id: 'com.example.' + app },
        t,
        2
      )
    }
    at += span
    n++
  }
}

const secondBySecond = (store: Store) => {
  for (let i = 0; i < DAY; i++) {
    store.heartbeat(
      { kind: 'active', app: i % 2 === 0 ? 'Obsidian' : 'Safari' },
      BASE + i,
      2
    )
  }
}

const CASES: Case[] = [
  {
    name: 'realistic day (merged events)',
    budget: 50,
    fill: realisticDay,
    expected: 0,
  },
  {
    name: 'synthetic worst case (one event per second, unmergeable)',
    budget: null,
    fill: secondBySecond,
    expected: DAY,
  },
]

const measure = (test: Case) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ody-bench-'))
  const store = openStore(path.join(dir, 'ody.db'))
  store.transact(() => test.fill(store))
  const read = () => store.eventsBetween(BASE, BASE + DAY)
  const events = read()
  const samples: number[] = []
  for (let run = 0; run < RUNS; run++) {
    const started = performance.now()
    read()
    samples.push(performance.now() - started)
  }
  store.close()
  fs.rmSync(dir, { recursive: true, force: true })
  samples.sort((a, b) => a - b)
  return { events: events.length, samples }
}

const ms = (value: number) => value.toFixed(1).padStart(7) + ' ms'

console.log(`ody store read benchmark, ${RUNS} runs per case`)
console.log(`node ${process.version} on ${os.cpus()[0].model}, ${os.cpus().length} cores`)
console.log(`load average ${os.loadavg().map(n => n.toFixed(2)).join(' ')}`)
console.log('')

let over = 0
for (const test of CASES) {
  const { events, samples } = measure(test)
  const median = quantile(samples, 0.5)
  console.log(`${test.name}: ${events} events over a 24 h range`)
  console.log(`  min   ${ms(samples[0])}`)
  console.log(`  p50   ${ms(median)}`)
  console.log(`  p90   ${ms(quantile(samples, 0.9))}`)
  console.log(`  max   ${ms(samples[samples.length - 1])}`)
  if (test.expected > 0 && events !== test.expected) {
    console.log(`  FAIL expected ${test.expected} events, read ${events}`)
    over++
  }
  if (test.budget === null) {
    console.log('  INFO reported only; heartbeat merging keeps a real day far below this shape')
  } else if (median > test.budget) {
    console.log(`  FAIL median is over the ${test.budget} ms budget`)
    over++
  } else {
    console.log(
      `  OK median is ${(test.budget / median).toFixed(1)}x inside the ${test.budget} ms budget`
    )
  }
  console.log('')
}

if (over > 0) {
  console.log(`${over} case(s) failed`)
  process.exit(1)
}
console.log('every budgeted case is inside budget')

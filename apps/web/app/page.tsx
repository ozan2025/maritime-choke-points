import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Badge variant="secondary" className="font-mono text-xs tracking-wide tabular-nums">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        scaffold ready · M1 · 2026-05-07
      </Badge>
      <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
        Maritime Choke Points
      </h1>
      <p className="max-w-2xl text-balance text-lg text-muted-foreground">
        A real-time AIS dashboard for the Strait of Malacca / Singapore corridor, with a
        coverage-gap monitor for Hormuz, Suez, and Bab el-Mandeb.
      </p>
    </main>
  );
}

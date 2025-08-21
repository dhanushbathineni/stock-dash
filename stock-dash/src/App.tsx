import React, { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Search, RefreshCw, Plus, Trash2 } from "lucide-react";

// --- Types ---
type Quote = {
  symbol: string;
  price: number;
  changePercent: number;
  lastUpdated: number;
};

type SortKey = "symbol" | "price" | "changePercent";
type SortDir = "asc" | "desc";

type CandlePoint = { time: number; close: number };

// --- Constants ---
const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
const REFRESH_MS = 30000; // Changed from 6ms to 30 seconds

// --- In-memory storage (replacing localStorage) ---
let storedSymbols: string[] = DEFAULT_SYMBOLS;

function loadSymbols(): string[] {
  return [...storedSymbols];
}

function saveSymbols(symbols: string[]) {
  storedSymbols = [...symbols];
}

// --- Mock API functions (since we can't use external APIs without keys) ---
function generateMockPrice(symbol: string): Quote {
  // Generate consistent but varying mock data based on symbol
  const basePrice = symbol.length * 50 + Math.random() * 100;
  const change = (Math.random() - 0.5) * 10;
  
  return {
    symbol,
    price: basePrice,
    changePercent: change,
    lastUpdated: Math.floor(Date.now() / 1000)
  };
}

function generateMockCandles(symbol: string): CandlePoint[] {
  const data: CandlePoint[] = [];
  const now = Math.floor(Date.now() / 1000);
  const basePrice = symbol.length * 50;
  
  for (let i = 60; i >= 0; i--) {
    const time = now - (i * 24 * 3600);
    const price = basePrice + Math.sin(i * 0.1) * 20 + Math.random() * 10;
    data.push({ time, close: price });
  }
  
  return data;
}

async function fetchQuoteFinnhub(symbol: string, token: string): Promise<Quote> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
  
  // For demo purposes, return mock data
  return generateMockPrice(symbol);
}

async function fetchDailyCandles(symbol: string, token: string): Promise<CandlePoint[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
  
  // For demo purposes, return mock data
  return generateMockCandles(symbol);
}

// --- Utilities ---
function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function fmtUSD(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fmtTime(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

// --- Main Component ---
export default function StockDashboard() {
  const [symbols, setSymbols] = useState<string[]>(loadSymbols());
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [search, setSearch] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [newSymbol, setNewSymbol] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [chartData, setChartData] = useState<CandlePoint[] | null>(null);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // Mock API key for demo
  const apiKey = "demo_key";

  useEffect(() => {
    saveSymbols(symbols);
  }, [symbols]);

  // Fetch quotes (initial + poll)
  const fetchAll = async () => {
    if (!symbols.length) return;
    setLoading(true);
    setErrors([]);
    try {
      const results = await Promise.allSettled(symbols.map((sym) => fetchQuoteFinnhub(sym, apiKey)));
      const ok: Quote[] = [];
      const errs: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") ok.push(r.value);
        else errs.push(`${symbols[i]} — ${r.reason}`);
      });
      setQuotes(ok);
      setErrors(errs);
    } catch (error) {
      setErrors([`Failed to fetch quotes: ${error}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(fetchAll, REFRESH_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [symbols.join(',')]); // Fixed dependency

  useEffect(() => {
    const loadChart = async () => {
      if (!selected) {
        setChartData(null);
        return;
      }
      setChartLoading(true);
      setChartError(null);
      try {
        const data = await fetchDailyCandles(selected, apiKey);
        setChartData(data);
      } catch (err: any) {
        setChartError(err?.message || "Failed to load chart");
        setChartData(null);
      } finally {
        setChartLoading(false);
      }
    };

    loadChart();
  }, [selected, apiKey]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toUpperCase();
    let rows = quotes.filter((r) => (q ? r.symbol.includes(q) : true));
    rows = rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      if (sortKey === "price") cmp = a.price - b.price;
      if (sortKey === "changePercent") cmp = a.changePercent - b.changePercent;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [quotes, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const addSymbol = () => {
    const s = newSymbol.trim().toUpperCase();
    if (!s) return;
    if (symbols.includes(s)) return setNewSymbol("");
    setSymbols((xs) => [...xs, s]);
    setNewSymbol("");
  };

  const removeSymbol = (sym: string) => {
    setSymbols((xs) => xs.filter((x) => x !== sym));
    if (selected === sym) setSelected(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">📈 Stock Price Dashboard</h1>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search symbols…"
              className="w-full sm:w-64 rounded-xl border border-gray-300 pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Controls: add symbol */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add symbol (e.g., NVDA)"
            className="w-48 rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addSymbol();
            }}
          />
          <button
            onClick={addSymbol}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-3 py-2 hover:bg-blue-700 active:bg-blue-800"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* Table + Chart grid */}
      <main className="max-w-6xl mx-auto px-4 mt-4 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Table */}
        <section className="lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th
                      className="px-4 py-3 min-w-[110px] cursor-pointer select-none"
                      onClick={() => toggleSort("symbol")}
                    >
                      Symbol {sortKey === "symbol" && <SortBadge dir={sortDir} />}
                    </th>
                    <th
                      className="px-4 py-3 min-w-[120px] cursor-pointer select-none"
                      onClick={() => toggleSort("price")}
                    >
                      Price {sortKey === "price" && <SortBadge dir={sortDir} />}
                    </th>
                    <th
                      className="px-4 py-3 min-w-[120px] cursor-pointer select-none"
                      onClick={() => toggleSort("changePercent")}
                    >
                      Change % {sortKey === "changePercent" && <SortBadge dir={sortDir} />}
                    </th>
                    <th className="px-4 py-3 min-w-[170px]">Last Update</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        <div className="inline-flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full inline-block animate-spin" />
                          Loading quotes…
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && filteredSorted.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        No matches.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filteredSorted.map((q) => (
                      <tr key={q.symbol} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">
                          <button
                            className="hover:underline"
                            onClick={() => setSelected(q.symbol)}
                            title="Show chart"
                          >
                            {q.symbol}
                          </button>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{fmtUSD(q.price)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={classNames(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                              q.changePercent > 0
                                ? "bg-green-100 text-green-700"
                                : q.changePercent < 0
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            )}
                          >
                            {q.changePercent > 0 ? "+" : ""}
                            {q.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{fmtTime(q.lastUpdated)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button
                              className="text-gray-500 hover:text-red-600"
                              title="Remove"
                              onClick={() => removeSymbol(q.symbol)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {errors.length > 0 && (
              <div className="border-t px-4 py-3 text-xs text-red-700 bg-red-50">
                {errors.slice(0, 3).map((e, idx) => (
                  <div key={idx}>• {String(e)}</div>
                ))}
                {errors.length > 3 && <div>…and {errors.length - 3} more.</div>}
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Demo with mock data. Refresh every {Math.round(REFRESH_MS / 1000)}s.
          </p>
        </section>

        {/* Chart Panel */}
        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm h-[420px] flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">
                  {selected ? `${selected} — Daily` : "Select a symbol for chart"}
                </h2>
                {selected && (
                  <button
                    className="inline-flex items-center gap-2 text-sm rounded-xl border px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200"
                    onClick={() => {
                      setChartLoading(true);
                      setSelected(selected);
                    }}
                  >
                    <RefreshCw className={classNames("h-3.5 w-3.5", chartLoading && "animate-spin")} />
                    Refresh
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 p-4">
              {!selected && (
                <div className="h-full grid place-items-center text-gray-500">
                  Pick a row in the table to see its chart.
                </div>
              )}
              {selected && chartLoading && (
                <div className="h-full grid place-items-center text-gray-500">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full inline-block animate-spin" />
                    Loading chart…
                  </div>
                </div>
              )}
              {selected && !chartLoading && chartError && (
                <div className="h-full grid place-items-center text-red-600 text-sm">
                  {chartError}
                </div>
              )}
              {selected && !chartLoading && !chartError && chartData && chartData.length > 1 && (
                <div className="h-full w-full">
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart
                      data={chartData.map((d) => ({
                        date: new Date(d.time * 1000).toLocaleDateString(),
                        close: d.close,
                      }))}
                      margin={{ left: 12, right: 12, top: 8, bottom: 8 }}
                    >
                      <XAxis dataKey="date" hide />
                      <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(v: any) => fmtUSD(Number(v))}
                        labelFormatter={(label) => label}
                      />
                      <Line type="monotone" dataKey="close" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Tip: Click symbols in the table to view charts.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-10 text-xs text-gray-500">
        Built with React + Tailwind + Recharts. Demo version with mock data.
      </footer>
    </div>
  );
}

function SortBadge({ dir }: { dir: SortDir }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-600">
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}
"use client";

// Page détail d'un titre détenu (clic sur une ligne du Portefeuille) : cours sur 1 an,
// position, poids dans le portefeuille, place / zone / secteur et dividendes.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";
import { useFxRates, toCurrency } from "@/lib/fx";
import { useBaseCurrency } from "@/lib/profile";
import { positionWeight, priceSummary, purchaseMarker, priceDomain } from "@/lib/tickerDetail";
import { dividendPositions, FREQUENCY_LABELS } from "@/lib/dividendCalendar";
import { signedPct } from "@/lib/chartSummary";
import AppHeader from "../../components/AppHeader";
import TickerLogo from "../../components/TickerLogo";
import { Card, Delta, AssetTypeBadge, formatMoney, formatPercent } from "../../components/ui";
import { SkeletonRegion, SkeletonChart } from "../../components/ui/Skeleton";

const ACCOUNT_LABELS = { PEA: "PEA", CTO: "Compte-titres", AV: "Assurance-vie", PER: "PER", CRYPTO: "Crypto" };

const nf = (v, d = 2) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const longDate = (d) => {
  if (!d) return null;
  const date = typeof d === "number" ? new Date(d * 1000) : new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
const monthTick = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { month: "short" });

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums text-ink">{children}</dd>
    </div>
  );
}

export default function TickerDetailPage() {
  const params = useParams();
  const ticker = useMemo(() => {
    const raw = String(params?.ticker || "");
    try {
      return decodeURIComponent(raw).toUpperCase();
    } catch {
      return raw.toUpperCase();
    }
  }, [params]);

  const [stocks, setStocks] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyStatus, setHistoryStatus] = useState("loading");
  const { rates } = useFxRates();
  const base = useBaseCurrency();

  useEffect(() => {
    let alive = true;
    apiFetch("/api/user/portfolio")
      .then((d) => alive && setStocks(d.stocks || []))
      .catch((err) => alive && setLoadError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  const stock = useMemo(
    () => (stocks || []).find((s) => String(s.ticker).toUpperCase() === ticker) || null,
    [stocks, ticker]
  );

  useEffect(() => {
    if (!stock) return;
    let alive = true;
    setHistoryStatus("loading");
    apiFetch(`/api/market/history/${encodeURIComponent(stock.ticker)}`)
      .then((d) => {
        if (!alive) return;
        setHistory(d);
        setHistoryStatus("ok");
      })
      .catch(() => alive && setHistoryStatus("error"));
    return () => {
      alive = false;
    };
  }, [stock]);

  const summary = useMemo(() => priceSummary(history?.points), [history]);
  const weight = useMemo(
    () => (stocks ? positionWeight(stocks, ticker, (v, cur) => toCurrency(v, cur, base, rates)) : null),
    [stocks, ticker, base, rates]
  );
  const dividend = useMemo(() => (stock ? dividendPositions([stock], (v) => v)[0] || null : null), [stock]);

  const marker = useMemo(() => purchaseMarker(summary?.series, stock?.boughtAt), [summary, stock?.boughtAt]);
  // Échelle : adaptée au cours par défaut (un PRU très éloigné aplatirait la courbe) ; le PRU peut être ajouté à l'échelle
  const [pruInScale, setPruInScale] = useState(false);
  const domain = useMemo(() => priceDomain(summary?.series, pruInScale ? stock?.pru : 0), [summary, stock?.pru, pruInScale]);
  const pruVisible = stock?.pru > 0 && Array.isArray(domain) && typeof domain[0] === "number" && stock.pru >= domain[0] && stock.pru <= domain[1];
  const pruSide = stock?.pru > 0 && !pruVisible && typeof domain[0] === "number" ? (stock.pru < domain[0] ? "sous" : "au-dessus de") : null;

  // Date d'achat : enregistrée dès le choix (facultative ; vide = retirée)
  const [dateError, setDateError] = useState(null);
  const saveBoughtAt = async (value) => {
    const previous = stock?.boughtAt ?? null;
    setDateError(null);
    setStocks((list) => list.map((x) => (x.ticker === stock.ticker ? { ...x, boughtAt: value || null } : x)));
    try {
      await apiFetch(`/api/user/portfolio/${encodeURIComponent(stock.ticker)}`, { method: "PATCH", body: { boughtAt: value || null } });
    } catch (err) {
      setStocks((list) => list.map((x) => (x.ticker === stock.ticker ? { ...x, boughtAt: previous } : x)));
      setDateError(err.message || "Enregistrement impossible.");
    }
  };
  const today = new Date().toISOString().slice(0, 10);

  const cur = stock?.currency || "EUR";
  const qty = Number(stock?.quantity) || 0;
  const value = stock && typeof stock.close === "number" ? stock.close * qty : null;
  const gainPct = stock?.pru > 0 && typeof stock.close === "number" ? ((stock.close - stock.pru) / stock.pru) * 100 : null;
  const gain = stock?.pru > 0 && value != null ? value - stock.pru * qty : null;

  return (
    <main className="min-h-screen bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/portfolio"
          className="mb-4 inline-flex items-center gap-1 rounded text-sm font-medium text-ink-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true">←</span> Portefeuille
        </Link>

        {loadError ? (
          <div role="alert" className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">
            Impossible de charger vos données : {loadError}
          </div>
        ) : !stocks ? (
          <SkeletonRegion label="Chargement du titre…" className="space-y-4">
            <SkeletonChart />
          </SkeletonRegion>
        ) : !stock ? (
          <Card>
            <h1 className="text-xl font-bold text-ink">{ticker || "Titre"} introuvable</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Ce titre ne fait pas (ou plus) partie de votre portefeuille.{" "}
              <Link href="/portfolio" className="font-medium text-accent underline-offset-2 hover:underline">
                Revenir au portefeuille
              </Link>
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* En-tête : identité du titre, cours et variation du jour */}
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <TickerLogo ticker={stock.ticker} logo={stock.logo} size={48} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-ink">{stock.ticker}</h1>
                    <AssetTypeBadge type={stock.type} />
                  </div>
                  {stock.name && stock.name !== stock.ticker && <p className="text-ink">{stock.name}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums text-ink">{formatMoney(stock.close, cur)}</p>
                {Number.isFinite(stock.dayChangePercent) && (
                  <p className="text-sm text-ink-muted">
                    <Delta value={stock.dayChangePercent} /> aujourd&apos;hui
                  </p>
                )}
              </div>
            </header>

            {/* Cours sur 1 an (route GET /api/market/history/:ticker) */}
            <Card as="section" aria-labelledby="price-title">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="price-title" className="text-lg font-bold text-ink">
                  Cours sur 1 an
                </h2>
                {summary && (
                  <span className="text-sm text-ink-muted">
                    <Delta value={summary.changePct} /> depuis le {longDate(summary.from)}
                  </span>
                )}
              </div>
              {historyStatus === "loading" ? (
                <div className="h-64 animate-pulse rounded-lg bg-surface-2" role="status" aria-label="Chargement du cours sur 1 an" />
              ) : historyStatus === "error" || !summary ? (
                <p className="text-sm text-ink-muted">L&apos;historique du cours est momentanément indisponible.</p>
              ) : (
                <>
                  {pruSide && (
                    <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-3 py-1 font-medium text-warn">
                        PRU {nf(stock.pru)} {cur} · {pruSide} l&apos;échelle {pruSide === "sous" ? "▼" : "▲"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPruInScale(true)}
                        className="rounded text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Afficher le PRU sur le graphique
                      </button>
                    </p>
                  )}
                  {pruInScale && stock.pru > 0 && (
                    <p className="mb-2 text-sm">
                      <button
                        type="button"
                        onClick={() => setPruInScale(false)}
                        className="rounded text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Adapter l&apos;échelle au cours
                      </button>
                    </p>
                  )}
                  <div
                    className="h-64"
                    role="img"
                    aria-label={`Cours de ${stock.ticker} sur 1 an : ${signedPct(summary.changePct)}, de ${nf(summary.first)} à ${nf(summary.last)} ${cur} ; plus bas ${nf(summary.min.close)}, plus haut ${nf(summary.max.close)}.`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={summary.series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                        <XAxis dataKey="date" tickFormatter={monthTick} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} minTickGap={28} />
                        <YAxis domain={domain} tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} width={56} tickFormatter={(v) => nf(v, v >= 1000 ? 0 : 2)} />
                        <Tooltip
                          labelFormatter={(d) => longDate(d)}
                          formatter={(v) => [formatMoney(v, cur), "Clôture"]}
                        />
                        {pruVisible && (
                          <ReferenceLine
                            y={stock.pru}
                            stroke="rgb(var(--chart-3))"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            ifOverflow="extendDomain"
                            label={{ value: `PRU ${nf(stock.pru)}`, position: "insideTopLeft", fontSize: 12, fontWeight: 600, fill: "rgb(var(--chart-3))" }}
                          />
                        )}
                        {marker?.date && (
                          <ReferenceLine
                            x={marker.date}
                            stroke="rgb(var(--chart-1))"
                            strokeWidth={2}
                            strokeDasharray="2 3"
                            label={{ value: "Achat", position: "insideTopRight", fontSize: 12, fontWeight: 600, fill: "rgb(var(--chart-1))" }}
                          />
                        )}
                        {marker?.date && (
                          <ReferenceDot x={marker.date} y={marker.close} r={5} fill="rgb(var(--chart-1))" stroke="rgb(var(--surface))" strokeWidth={2} />
                        )}
                        <Line type="monotone" dataKey="close" name="Clôture" stroke="rgb(var(--accent))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-ink-muted">Plus bas</dt>
                      <dd className="font-medium tabular-nums text-ink">
                        {formatMoney(summary.min.close, cur)} <span className="text-xs font-normal text-ink-muted">le {longDate(summary.min.date)}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Plus haut</dt>
                      <dd className="font-medium tabular-nums text-ink">
                        {formatMoney(summary.max.close, cur)} <span className="text-xs font-normal text-ink-muted">le {longDate(summary.max.date)}</span>
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] text-ink-muted/70">
                    Cours de clôture quotidiens dans la devise de cotation ({cur}), hors dividendes
                    {pruVisible && " ; ligne ambre : votre PRU"}
                    {marker?.date && " ; repère bleu : votre achat"}.
                    {marker?.before && " Votre achat est antérieur à la période affichée."}
                    {history?.stale && " Données non actualisées (service momentanément indisponible)."}
                  </p>
                </>
              )}
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card as="section" aria-labelledby="position-title">
                <h2 id="position-title" className="mb-2 text-lg font-bold text-ink">
                  Ma position
                </h2>
                <dl>
                  <Row label="Quantité">{nf(qty, Number.isInteger(qty) ? 0 : 4)}</Row>
                  <Row label="PRU">{stock.pru > 0 ? formatMoney(stock.pru, cur) : "—"}</Row>
                  <Row label="Date d'achat">
                    <input
                      type="date"
                      value={stock.boughtAt || ""}
                      max={today}
                      onChange={(e) => saveBoughtAt(e.target.value)}
                      aria-label="Date d'achat"
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    {dateError && <span role="alert" className="mt-1 block text-xs text-loss">{dateError}</span>}
                  </Row>
                  <Row label="Valeur">
                    <span className="money">{formatMoney(value, cur)}</span>
                  </Row>
                  <Row label="Plus-value latente">
                    {gain != null ? (
                      <>
                        <span className="money">{formatMoney(gain, cur)}</span> <Delta value={gainPct} className="ml-1" />
                      </>
                    ) : (
                      "—"
                    )}
                  </Row>
                  <Row label="Poids dans le portefeuille">
                    {weight != null ? formatPercent(weight, { signed: false, decimals: 1 }) : "—"}
                  </Row>
                  <Row label="Enveloppe">{ACCOUNT_LABELS[stock.account] || "Non renseignée"}</Row>
                </dl>
                <p className="mt-2 text-[11px] text-ink-muted/70">Poids calculé sur la valeur des titres, hors liquidités, en {base}.</p>
              </Card>

              <Card as="section" aria-labelledby="profile-title">
                <h2 id="profile-title" className="mb-2 text-lg font-bold text-ink">
                  Le titre
                </h2>
                <dl>
                  <Row label="Place de cotation">{stock.exchange || "—"}</Row>
                  <Row label="Devise">{cur}</Row>
                  <Row label="Zone">{stock.zone || stock.country || "—"}</Row>
                  {stock.exposure && (
                    <Row label="Exposition">{stock.commodity ? stock.exposure : `indice ${stock.exposure}`}</Row>
                  )}
                  <Row label="Secteur">{stock.sector || "—"}</Row>
                </dl>
              </Card>
            </div>

            <Card as="section" aria-labelledby="dividend-title">
              <h2 id="dividend-title" className="mb-2 text-lg font-bold text-ink">
                Dividendes
              </h2>
              {!dividend ? (
                <p className="text-sm text-ink-muted">Aucun dividende connu pour ce titre.</p>
              ) : (
                <dl>
                  <Row label="Dividende annuel par part">{formatMoney(dividend.divPerShare, cur)}</Row>
                  <Row label="Revenu annuel de la ligne">
                    <span className="money">{formatMoney(dividend.totalAnnual, cur)}</span>
                  </Row>
                  <Row label="Rendement au cours actuel">{formatPercent(dividend.yieldPercent, { signed: false })}</Row>
                  <Row label="Rendement sur PRU">
                    {dividend.yieldOnCost != null ? formatPercent(dividend.yieldOnCost, { signed: false }) : "—"}
                  </Row>
                  <Row label="Fréquence">
                    {FREQUENCY_LABELS[dividend.frequency] || "—"}
                    {dividend.frequencyEstimated && <span className="font-normal text-ink-muted"> (estimée)</span>}
                  </Row>
                  {longDate(dividend.exDividendDate) && <Row label="Dernier détachement">{longDate(dividend.exDividendDate)}</Row>}
                  {longDate(dividend.nextExDividendDate) && (
                    <Row label="Prochain détachement">{longDate(dividend.nextExDividendDate)}</Row>
                  )}
                </dl>
              )}
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

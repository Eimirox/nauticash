"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

// URL de la carte du monde (TopoJSON)
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Mapping pays français → ISO codes NUMÉRIQUES (ISO 3166-1 numeric)
const COUNTRY_CODES = {
  "États-Unis": "840",
  "France": "250",
  "Allemagne": "276",
  "Royaume-Uni": "826",
  "Japon": "392",
  "Chine": "156",
  "Canada": "124",
  "Australie": "036",
  "Pays-Bas": "528",
  "Amsterdam": "528", // Pays-Bas
  "Belgique": "056",
  "Suisse": "756",
  "Italie": "380",
  "Espagne": "724",
  "Irlande": "372",
  "Luxembourg": "442",
  "Suède": "752",
  "Norvège": "578",
  "Danemark": "208",
  "Finlande": "246",
  "Autriche": "040",
  "CCC": "CRYPTO", // Crypto
};

export default function GeographiePage() {
  const router = useRouter();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usdToEur, setUsdToEur] = useState(0.92);
  const [tooltipContent, setTooltipContent] = useState("");

  // Fetch taux de change USD->EUR
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const data = await res.json();
        setUsdToEur(data.rates.EUR || 0.92);
      } catch (err) {
        console.log("Taux de change par défaut utilisé");
      }
    };
    fetchExchangeRate();
  }, []);

  // Fetch portfolio
  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000"}/api/user/portfolio`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setStocks(data.stocks || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  // Calculs géographiques
  const geoData = useMemo(() => {
    if (!stocks || stocks.length === 0) {
      return {
        byCountry: {},
        total: 0,
        countryList: [],
        maxValue: 0,
        topContinent: "N/A"
      };
    }

    // Grouper par pays
    const byCountry = {};
    let total = 0;

    stocks.forEach(s => {
      const country = s.country || "Unknown";
      console.log(`📍 ${s.ticker}: country="${country}", ISO: ${COUNTRY_CODES[country]}`);
      
      const value = (s.close || 0) * (s.quantity || 0);
      const valueEUR = s.currency === "USD" ? value * usdToEur : value;
      
      total += valueEUR;

      if (!byCountry[country]) {
        byCountry[country] = {
          country,
          isoCode: COUNTRY_CODES[country] || null,
          valueEUR: 0,
          valueOriginal: 0,
          currency: s.currency,
          stocks: []
        };
      }

      byCountry[country].valueEUR += valueEUR;
      byCountry[country].valueOriginal += value;
      byCountry[country].stocks.push({
        ticker: s.ticker,
        name: s.name,
        value: valueEUR
      });
    });

    // Convertir en liste triée
    const countryList = Object.values(byCountry)
      .sort((a, b) => b.valueEUR - a.valueEUR);

    // Valeur max pour l'échelle de couleurs
    const maxValue = Math.max(...countryList.map(c => c.valueEUR));

    // Continent principal (simplifié)
    const topCountry = countryList[0]?.country || "N/A";
    let topContinent = "N/A";
    if (["États-Unis", "Canada"].includes(topCountry)) topContinent = "Amérique";
    else if (["France", "Allemagne", "Royaume-Uni", "Pays-Bas", "Amsterdam", "Belgique", "Suisse", "Italie", "Espagne"].includes(topCountry)) topContinent = "Europe";
    else if (["Chine", "Japon"].includes(topCountry)) topContinent = "Asie";

    return {
      byCountry,
      total,
      countryList,
      maxValue,
      topContinent
    };
  }, [stocks, usdToEur]);

  const formatCurrency = (value) => {
    return value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + "€";
  };

  const formatPercent = (value, total) => {
    if (total === 0) return "0%";
    return ((value / total) * 100).toFixed(1) + "%";
  };

  // Obtenir la couleur selon la valeur (gradient vert)
  const getColor = (isoCode) => {
    if (!isoCode) return "#E5E7EB";
    
    const countryData = geoData.countryList.find(c => c.isoCode === isoCode);
    if (!countryData) return "#E5E7EB";

    const intensity = countryData.valueEUR / geoData.maxValue;
    
    // Gradient de vert emerald
    if (intensity > 0.7) return "#059669"; // Très foncé
    if (intensity > 0.4) return "#10B981"; // Foncé
    if (intensity > 0.2) return "#34D399"; // Moyen
    if (intensity > 0.1) return "#6EE7B7"; // Clair
    return "#A7F3D0"; // Très clair
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-3 group transition-transform hover:scale-105"
            >
              <div className="relative">
                <img
                  src="/logo_nauticash.webp?v=3"
                  alt="Logo Nauticash"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm"
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-600 to-blue-600 bg-clip-text text-transparent">
                  Nauticash
                </span>
                <p className="text-xs text-slate-500">Géographie</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/analytics")}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <svg
                  className="w-4 h-4 sm:hidden"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="hidden sm:inline">← Analytics</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Analytics du Portefeuille
          </h1>
          <p className="text-slate-600">
            Visualisez la répartition et l'évolution de vos investissements
          </p>
        </div>

        {/* Tabs */}
        <nav className="mb-8 border-b border-slate-200">
          {[
            { key: "vue", label: "Vue d'ensemble", route: "/analytics" },
            { key: "performance", label: "Performance", route: "/analytics/performance" },
            { key: "dividendes", label: "Dividendes", route: "/analytics/dividendes" },
            { key: "geographie", label: "Géographie", route: "/analytics/geographie" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.route) {
                  router.push(tab.route);
                }
              }}
              disabled={!tab.route}
              className={`relative px-6 py-3 text-sm font-medium transition-all ${
                tab.key === "geographie"
                  ? "text-emerald-600"
                  : tab.route 
                    ? "text-slate-600 hover:text-slate-900 cursor-pointer"
                    : "text-slate-400 cursor-not-allowed"
              }`}
            >
              {tab.label}
              {tab.key === "geographie" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-600 to-blue-600" />
              )}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pays représentés */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase">Pays</h3>
                </div>
                <p className="text-3xl font-bold text-emerald-600">
                  {geoData.countryList.filter(c => c.isoCode && c.isoCode !== "CRYPTO").length}
                </p>
                <p className="text-xs text-slate-500">pays représentés</p>
              </div>

              {/* Continent principal */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-600 uppercase">Zone principale</h3>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {geoData.topContinent}
                </p>
                <p className="text-xs text-slate-500">continent dominant</p>
              </div>

              {/* Diversification */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-emerald-700 uppercase">Diversification</h3>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {geoData.countryList.length <= 2 ? "Faible" : geoData.countryList.length <= 4 ? "Moyenne" : "Élevée"}
                </p>
                <p className="text-xs text-emerald-700">
                  {geoData.countryList.length} zones distinctes
                </p>
              </div>
            </div>

            {/* Carte du Monde */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">Carte de l'Exposition Géographique</h3>
              </div>

              {/* Légende */}
              <div className="mb-4 flex items-center gap-4 text-xs text-slate-600">
                <span>Exposition :</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#A7F3D0" }}></div>
                  <span>Faible</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10B981" }}></div>
                  <span>Moyenne</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#059669" }}></div>
                  <span>Élevée</span>
                </div>
              </div>

              <div className="relative bg-slate-50 rounded-lg overflow-hidden" style={{ height: "500px" }}>
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: 147
                  }}
                >
                  <ZoomableGroup center={[0, 20]} zoom={1}>
                    <Geographies geography={geoUrl}>
                      {({ geographies }) => {
                        console.log("🗺️ PREMIERS PAYS DE LA CARTE:");
                        geographies.slice(0, 15).forEach(g => {
                          console.log(`  - ${g.properties?.name || "?"} → ID: "${g.id}"`);
                        });
                        
                        return geographies.map((geo) => {
                          const isoCode = geo.id;
                          const countryData = geoData.countryList.find(c => c.isoCode === isoCode);
                          
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={getColor(isoCode)}
                              stroke="#FFFFFF"
                              strokeWidth={0.5}
                              style={{
                                default: { outline: "none" },
                                hover: { fill: "#F59E0B", outline: "none", cursor: "pointer" },
                                pressed: { outline: "none" }
                              }}
                              onMouseEnter={() => {
                                if (countryData) {
                                  setTooltipContent(
                                    `${countryData.country}: ${formatCurrency(countryData.valueEUR)} (${formatPercent(countryData.valueEUR, geoData.total)})`
                                  );
                                }
                              }}
                              onMouseLeave={() => {
                                setTooltipContent("");
                              }}
                            />
                          );
                        });
                      }}
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>

                {/* Tooltip */}
                {tooltipContent && (
                  <div className="absolute top-4 left-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-xl text-sm font-medium">
                    {tooltipContent}
                  </div>
                )}
              </div>
            </div>

            {/* Tableau Top Pays */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">Répartition par Pays</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Pays</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Valeur</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">% Portfolio</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geoData.countryList.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: getColor(item.isoCode) }}
                            ></div>
                            <span className="text-sm font-medium text-slate-900">{item.country}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 text-sm font-bold text-emerald-600">
                          {formatCurrency(item.valueEUR)}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            {formatPercent(item.valueEUR, geoData.total)}
                          </span>
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-slate-600">
                          {item.stocks.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">🌍 Exposition géographique</p>
                  <p className="text-blue-700">
                    La carte affiche votre exposition par pays. Survolez un pays coloré pour voir les détails. 
                    Une bonne diversification géographique réduit les risques liés à un seul marché.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
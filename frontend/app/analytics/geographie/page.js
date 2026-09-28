"use client";

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useFxRates, toCurrency, currencySymbol } from "@/lib/fx";
import { useBaseCurrency, useDiscreet } from "@/lib/profile";
import AppHeader from "../../components/AppHeader";
import Link from "next/link";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

// URL de la carte du monde (TopoJSON)
// Fond de carte servi par le site (world-atlas 2.0.2, Natural Earth) : pas de dépendance à un CDN externe
const geoUrl = "/maps/countries-110m.json";

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

// Code ISO2 (renvoyé par le backend) → continent
const CONTINENTS = {
  ...Object.fromEntries(["US", "CA", "MX", "BR", "AR", "UY", "BM", "KY"].map((c) => [c, "Amérique"])),
  ...Object.fromEntries(
    ["FR", "DE", "GB", "NL", "BE", "LU", "IE", "CH", "IT", "ES", "PT", "AT", "SE", "NO", "DK", "FI", "PL", "GR", "JE", "CY"].map((c) => [c, "Europe"])
  ),
  ...Object.fromEntries(["JP", "CN", "HK", "TW", "KR", "IN", "SG", "IL"].map((c) => [c, "Asie"])),
  AU: "Océanie",
  NZ: "Océanie",
  ZA: "Afrique",
};

export default function GeographiePage() {
  const [loadError, setLoadError] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tooltipContent, setTooltipContent] = useState("");

  // Taux BCE servis par le backend (toutes devises)
  const { rates, stale: fxStale } = useFxRates();
  // Montants convertis dans la devise de référence du profil (EUR par défaut)
  const base = useBaseCurrency();
  const [discreet] = useDiscreet();
  const inBase = (value, currency) => toCurrency(value, currency, base, rates) ?? ((currency || "EUR") === base ? value : 0);

  // Fetch portfolio
  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/api/user/portfolio");
        setStocks(data.stocks || []);
      } catch (err) {
        console.error(err);
        setLoadError(`Impossible de charger vos données : ${err.message}`);
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
      // Pays normalisé par le backend (nom + code ISO numérique utilisé par la carte)
      const country = s.country || "Inconnu";
      const isoCode = s.countryNumeric || COUNTRY_CODES[country] || (country === "Crypto" ? "CRYPTO" : null);
      
      const value = (s.close || 0) * (s.quantity || 0);
      const valueBase = inBase(value, s.currency);
      
      total += valueBase;

      if (!byCountry[country]) {
        byCountry[country] = {
          country,
          isoCode,
          countryCode: s.countryCode || null,
          valueBase: 0,
          valueOriginal: 0,
          currency: s.currency,
          stocks: []
        };
      }

      byCountry[country].valueBase += valueBase;
      byCountry[country].valueOriginal += value;
      byCountry[country].stocks.push({
        ticker: s.ticker,
        name: s.name,
        value: valueBase
      });
    });

    // Convertir en liste triée
    const countryList = Object.values(byCountry)
      .sort((a, b) => b.valueBase - a.valueBase);

    // Valeur max pour l'échelle de couleurs
    const maxValue = Math.max(...countryList.map(c => c.valueBase));

    // Continent principal (simplifié)
    // Continent principal : somme des valeurs par continent
    const byContinent = {};
    for (const c of countryList) {
      const continent = CONTINENTS[c.countryCode];
      if (continent) byContinent[continent] = (byContinent[continent] || 0) + c.valueBase;
    }
    const topContinent =
      Object.entries(byContinent).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      byCountry,
      total,
      countryList,
      maxValue,
      topContinent
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, rates, base]);

  const formatCurrency = (value) => {
    return value.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " " + currencySymbol(base);
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

    const intensity = countryData.valueBase / geoData.maxValue;
    
    // Gradient de vert emerald
    if (intensity > 0.7) return "#059669"; // Très foncé
    if (intensity > 0.4) return "#10B981"; // Foncé
    if (intensity > 0.2) return "#34D399"; // Moyen
    if (intensity > 0.1) return "#6EE7B7"; // Clair
    return "#A7F3D0"; // Très clair
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {loadError && (
        <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {/* Header */}
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Géographie
          </h1>
          <p className="text-slate-600">
            Exposition de votre portefeuille par pays et par continent.
          </p>
        </div>


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
                                    discreet
                                      ? `${countryData.country} (${formatPercent(countryData.valueBase, geoData.total)})`
                                      : `${countryData.country}: ${formatCurrency(countryData.valueBase)} (${formatPercent(countryData.valueBase, geoData.total)})`
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
                          <span className="money">{formatCurrency(item.valueBase)}</span>
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            {formatPercent(item.valueBase, geoData.total)}
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
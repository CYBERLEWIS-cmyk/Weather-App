import { useEffect, useMemo, useState } from "react";
import "../App.css";

const API_KEY = "e1ab742d6fc30b6d84173451fd531919";

function toDayLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { weekday: "short" });
}

function toPrettyDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function iconUrl(icon) {
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

function pickWeatherTheme(desc = "") {
    const d = desc.toLowerCase();
    if (d.includes("rain") || d.includes("drizzle") || d.includes("thunder")) return "wx-rain";
    if (d.includes("snow")) return "wx-snow";
    if (d.includes("clear")) return "wx-clear";
    if (d.includes("mist") || d.includes("fog") || d.includes("haze") || d.includes("smoke"))
        return "wx-fog";
    if (d.includes("cloud")) return "wx-clouds";
    return "wx-default";
}

// ✅ Smart summary (no AI API)
function makeSummary({ temp, feels, humidity, wind, desc, unit }) {
    const u = unit === "metric" ? "°C" : "°F";
    const wUnit = "m/s";

    const t = typeof temp === "number" ? temp : null;
    const f = typeof feels === "number" ? feels : null;
    const h = typeof humidity === "number" ? humidity : null;
    const w = typeof wind === "number" ? wind : null;
    const d = (desc || "").toLowerCase();

    const parts = [];

    // Condition-based opener
    if (d.includes("thunder")) parts.push("⚡ Thunderstorm conditions—best to stay cautious outdoors.");
    else if (d.includes("rain") || d.includes("drizzle"))
        parts.push("🌧 Expect wet conditions—carry an umbrella.");
    else if (d.includes("snow")) parts.push("❄️ Snowy conditions—dress warm and watch the roads.");
    else if (d.includes("fog") || d.includes("mist") || d.includes("haze"))
        parts.push("🌫 Low visibility conditions—drive carefully.");
    else if (d.includes("clear")) parts.push("☀️ Clear skies—great for outdoor plans.");
    else if (d.includes("cloud")) parts.push("☁️ Cloudy skies—comfortable day overall.");
    else parts.push("⛅ Conditions look fairly normal today.");

    // Temperature guidance
    if (t !== null) {
        const hot = unit === "metric" ? t >= 30 : t >= 86;
        const warm = unit === "metric" ? t >= 24 : t >= 75;
        const cool = unit === "metric" ? t <= 18 : t <= 64;
        const cold = unit === "metric" ? t <= 10 : t <= 50;

        if (hot) parts.push(`It’s hot at about ${Math.round(t)}${u}—hydrate and avoid peak sun.`);
        else if (warm) parts.push(`Warm around ${Math.round(t)}${u}—light clothing should be fine.`);
        else if (cold) parts.push(`Cold near ${Math.round(t)}${u}—layer up.`);
        else if (cool) parts.push(`A bit cool at ${Math.round(t)}${u}—a light jacket helps.`);
        else parts.push(`Temperature is moderate (~${Math.round(t)}${u}).`);
    }

    // Feels-like delta
    if (t !== null && f !== null) {
        const diff = Math.abs(f - t);
        if (diff >= 3) {
            parts.push(
                `Feels like ${Math.round(f)}${u} (noticeably ${f > t ? "warmer" : "cooler"} than actual).`
            );
        }
    }

    // Humidity
    if (h !== null) {
        if (h >= 75) parts.push("Humidity is high—expect a sticky feel.");
        else if (h <= 30) parts.push("Air is quite dry—stay hydrated.");
    }

    // Wind
    if (w !== null) {
        if (w >= 10) parts.push(`Windy (${w.toFixed(1)} ${wUnit})—secure loose items.`);
        else if (w >= 6) parts.push(`Breezy (${w.toFixed(1)} ${wUnit}).`);
    }

    // Keep it short (2–3 sentences)
    const sentence = parts.join(" ");
    // If it got long, trim to first ~2–3 parts
    if (parts.length > 3) return parts.slice(0, 3).join(" ");
    return sentence;
}

export default function Weather() {
    const [city, setCity] = useState("Johannesburg");
    const [query, setQuery] = useState("Johannesburg");

    const [unit, setUnit] = useState("metric"); // metric = °C, imperial = °F
    const unitLabel = unit === "metric" ? "°C" : "°F";

    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

    const [current, setCurrent] = useState(null);
    const [forecast, setForecast] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const canSearch = useMemo(() => query.trim().length >= 2, [query]);

    // Apply theme
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Initial fetch
    useEffect(() => {
        fetchAll(city, unit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-fetch on unit change
    useEffect(() => {
        if (city?.trim()) fetchAll(city, unit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unit]);

    // Weather background class
    useEffect(() => {
        const cls = pickWeatherTheme(current?.weather?.[0]?.description || "");
        setWeatherClass(cls);
    }, [current]);

    function setWeatherClass(cls) {
        const classes = ["wx-default", "wx-clear", "wx-clouds", "wx-rain", "wx-snow", "wx-fog"];
        document.body.classList.remove(...classes);
        document.body.classList.add(cls);
    }

    async function fetchAll(cityName, units) {
        const q = cityName.trim();
        if (!q) return;

        try {
            setLoading(true);
            setError("");

            // Current
            const weatherRes = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
                    q
                )}&units=${units}&appid=${API_KEY}`
            );

            if (!weatherRes.ok) {
                const msg = weatherRes.status === 404 ? "City not found" : "Failed to fetch weather";
                throw new Error(msg);
            }

            const weatherData = await weatherRes.json();
            setCurrent(weatherData);

            // Forecast
            const forecastRes = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
                    q
                )}&units=${units}&appid=${API_KEY}`
            );

            if (!forecastRes.ok) throw new Error("Failed to fetch forecast");

            const forecastData = await forecastRes.json();

            const byDate = new Map();
            for (const item of forecastData.list) {
                const date = item.dt_txt.split(" ")[0];
                if (!byDate.has(date)) byDate.set(date, []);
                byDate.get(date).push(item);
            }

            const daily = [];
            for (const [date, items] of byDate.entries()) {
                const chosen =
                    items.find((x) => x.dt_txt.includes("12:00:00")) || items[Math.floor(items.length / 2)];

                const temps = items.map((x) => x.main.temp);
                const min = Math.min(...temps);
                const max = Math.max(...temps);

                daily.push({
                    date,
                    label: toDayLabel(date),
                    pretty: toPrettyDate(date),
                    temp: chosen.main.temp,
                    min,
                    max,
                    desc: chosen.weather?.[0]?.description ?? "",
                    icon: chosen.weather?.[0]?.icon ?? "01d",
                });
            }

            daily.sort((a, b) => a.date.localeCompare(b.date));
            setForecast(daily.slice(0, 5));
            setCity(q);
        } catch (err) {
            setCurrent(null);
            setForecast([]);
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    function onSubmit(e) {
        e.preventDefault();
        if (!canSearch || loading) return;
        fetchAll(query, unit);
    }

    const currentIcon = current?.weather?.[0]?.icon;
    const currentDesc = current?.weather?.[0]?.description ?? "";
    const currentTemp = current?.main?.temp;
    const feelsLike = current?.main?.feels_like;
    const humidity = current?.main?.humidity;
    const wind = current?.wind?.speed;

    const summary = useMemo(() => {
        if (!current) return "";
        return makeSummary({
            temp: currentTemp,
            feels: feelsLike,
            humidity,
            wind,
            desc: currentDesc,
            unit,
        });
    }, [current, currentTemp, feelsLike, humidity, wind, currentDesc, unit]);

    return (
        <div className="glass">
            <div className="header">
                <div className="title">
                    <span className="badge">⛅</span>
                    <div>
                        <h1>Weather</h1>
                        <p className="subtitle">Current + 5-day forecast</p>
                    </div>
                </div>

                <div className="top-actions">
                    <div className="segmented">
                        <button
                            type="button"
                            className={unit === "metric" ? "seg active" : "seg"}
                            onClick={() => setUnit("metric")}
                        >
                            °C
                        </button>
                        <button
                            type="button"
                            className={unit === "imperial" ? "seg active" : "seg"}
                            onClick={() => setUnit("imperial")}
                        >
                            °F
                        </button>
                    </div>

                    <button
                        type="button"
                        className="ghost"
                        onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                        aria-label="Toggle theme"
                        title="Toggle dark/light"
                    >
                        {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                    </button>
                </div>
            </div>

            <form className="search" onSubmit={onSubmit}>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search city (e.g. Cape Town)"
                    spellCheck="false"
                />
                <button type="submit" disabled={!canSearch || loading}>
                    {loading ? "Loading…" : "Get Weather"}
                </button>
            </form>

            {error && <div className="alert">{error}</div>}

            {current && (
                <div className="current">
                    <div className="current-left">
                        <div className="place">
                            <h2>
                                {current.name}
                                {current?.sys?.country ? `, ${current.sys.country}` : ""}
                            </h2>
                            <p className="muted">
                                {new Date().toLocaleString(undefined, {
                                    weekday: "long",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>

                        <div className="temp-row">
                            {currentIcon && (
                                <img className="wx-icon" src={iconUrl(currentIcon)} alt={currentDesc || "icon"} />
                            )}
                            <div>
                                <div className="temp">
                                    {typeof currentTemp === "number" ? Math.round(currentTemp) : "--"}
                                    {unitLabel}
                                </div>
                                <div className="desc">{currentDesc}</div>
                            </div>
                        </div>

                        {/* ✅ Smart summary block */}
                        {summary && <div className="summary">{summary}</div>}
                    </div>

                    <div className="stats">
                        <div className="stat">
                            <span className="stat-k">Feels</span>
                            <span className="stat-v">
                {typeof feelsLike === "number" ? Math.round(feelsLike) : "--"}
                                {unitLabel}
              </span>
                        </div>
                        <div className="stat">
                            <span className="stat-k">Humidity</span>
                            <span className="stat-v">{typeof humidity === "number" ? humidity : "--"}%</span>
                        </div>
                        <div className="stat">
                            <span className="stat-k">Wind</span>
                            <span className="stat-v">{typeof wind === "number" ? wind : "--"} m/s</span>
                        </div>
                    </div>
                </div>
            )}

            {forecast.length > 0 && (
                <>
                    <div className="section-title">5-Day Forecast</div>
                    <div className="forecast">
                        {forecast.map((d) => (
                            <div key={d.date} className="day-card">
                                <div className="day-top">
                                    <div>
                                        <div className="day">{d.label}</div>
                                        <div className="date">{d.pretty}</div>
                                    </div>
                                    <img className="wx-mini" src={iconUrl(d.icon)} alt={d.desc} />
                                </div>

                                <div className="day-temp">
                  <span className="big">
                    {Math.round(d.temp)}
                      {unitLabel}
                  </span>
                                    <span className="range">
                    {Math.round(d.min)}
                                        {unitLabel} / {Math.round(d.max)}
                                        {unitLabel}
                  </span>
                                </div>

                                <div className="day-desc">{d.desc}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="footer">
                Tip: try <b>Cape Town</b>, <b>Durban</b>, <b>Pretoria</b>.
            </div>
        </div>
    );
}

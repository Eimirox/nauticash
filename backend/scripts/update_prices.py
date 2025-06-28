# backend/scripts/update_prices.py

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time, json, sys, os
from datetime import datetime
from dotenv import load_dotenv
import pymongo

# 1. Charger .env
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

# 2. Connexion MongoDB
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["walletDB"]
collection = db["prices"]

# 3. Tickers passés en argument
tickers = sys.argv[1:]
if not tickers:
    print("Usage: python update_prices.py TICKER1 [TICKER2 …]")
    sys.exit(1)

# 4. Config Selenium headless
options = Options()
options.add_argument("--headless")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--window-size=1920,1080")
options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
driver = webdriver.Chrome(options=options)

# 5. Accepter la bannière cookies Yahoo si nécessaire
driver.get("https://finance.yahoo.com/")
try:
    btn = WebDriverWait(driver, 5).until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Accept') or contains(text(),'Accepter')]"))
    )
    btn.click()
    time.sleep(1)
except:
    pass  # si pas de bannière, on continue

def fetch_from_browser(ticker):
    rec = {
        "symbol":   ticker,
        "date":     datetime.utcnow().strftime("%Y-%m-%d"),
        "open":     0,
        "close":    0,
        "high":     0,
        "low":      0,
        "volume":   0,
        "currency": "Unknown",
        "country":  "Unknown",
        "sector":   "Unknown",
        "industry": "Unknown"
    }

    # a) scrappe les données de cours via l'endpoint chart
    try:
        driver.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}")
        time.sleep(1.5)
        pre = driver.find_element(By.TAG_NAME, "pre").text
        chart = json.loads(pre).get("chart", {}).get("result")
        if chart and isinstance(chart, list) and chart[0].get("meta"):
            m = chart[0]["meta"]
            o = m.get("regularMarketOpen") or m.get("previousClose") or 0
            rec.update({
                "open":     round(o, 2),
                "close":    round(m.get("regularMarketPrice", 0), 2),
                "high":     round(m.get("regularMarketDayHigh", 0), 2),
                "low":      round(m.get("regularMarketDayLow", 0), 2),
                "volume":   int(m.get("regularMarketVolume", 0)),
                "currency": m.get("currency", "Unknown"),
                "country":  m.get("fullExchangeName") or m.get("exchangeName") or "Unknown"
            })
    except Exception as e:
        print(f"[{ticker}] Erreur chart : {e}")

    # b) scrappe sector & industry sur /profile
    try:
        driver.get(f"https://finance.yahoo.com/quote/{ticker}/profile?p={ticker}")
        profile = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'section[data-testid="asset-profile"]'))
        )
        sec_el = profile.find_element(
            By.XPATH,
            './/dt[contains(normalize-space(.),"Sector")]/following-sibling::dd//a'
        )
        ind_el = profile.find_element(
            By.XPATH,
            './/dt[contains(normalize-space(.),"Industry")]/following-sibling::a'
        )
        rec["sector"]   = sec_el.text.strip()
        rec["industry"] = ind_el.text.strip()
    except Exception as e:
        print(f"[{ticker}] Impossible de scraper sector/industry : {e}")

    return rec

def upsert_price(rec):
    # --- on ne matche plus que sur "symbol" pour écraser l'ancien document ---
    collection.update_one(
        {"symbol": rec["symbol"]},
        {"$set": rec},
        upsert=True
    )
    print(f"[{rec['symbol']}] mis à jour avec sector='{rec['sector']}', industry='{rec['industry']}'")

if __name__ == "__main__":
    for t in tickers:
        try:
            data = fetch_from_browser(t)
            upsert_price(data)
        except Exception as e:
            print(f"[{t}] Erreur inattendue : {e}")
    driver.quit()

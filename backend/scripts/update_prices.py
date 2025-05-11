# backend/scripts/update_prices.py

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time, json, sys, os
from datetime import datetime
from dotenv import load_dotenv
import pymongo

# 1. Charge .env
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

# 2. Connexion à MongoDB
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["walletDB"]
collection = db["prices"]

# 3. Arguments : tickers à traiter
tickers = sys.argv[1:]
if not tickers:
    print("Usage: python update_prices.py TICKER1 [TICKER2 ...]")
    sys.exit(1)

# 4. Config Selenium headless
options = Options()
options.headless = True
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--window-size=1920,1080")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)")

driver = webdriver.Chrome(options=options)

def fetch_from_browser(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    driver.get(url)
    time.sleep(2)
    pre = driver.find_element("tag name", "pre").text
    data = json.loads(pre)["chart"]["result"][0]["meta"]
    # extrait
    o = data.get("regularMarketOpen") or data.get("previousClose") or 0
    return {
        "symbol": ticker,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "open": round(o, 2),
        "close": round(data.get("regularMarketPrice", 0), 2),
        "high": round(data.get("regularMarketDayHigh", 0), 2),
        "low": round(data.get("regularMarketDayLow", 0), 2),
        "volume": int(data.get("regularMarketVolume", 0)),
        "currency": data.get("currency", "USD"),
        "country": "US"
    }

def upsert_price(rec):
    # unique index sur (symbol, date)
    collection.update_one(
        {"symbol": rec["symbol"], "date": rec["date"]},
        {"$set": rec},
        upsert=True
    )
    print(f"[{rec['symbol']}] ok")

if __name__ == "__main__":
    for t in tickers:
        try:
            rec = fetch_from_browser(t)
            upsert_price(rec)
        except Exception as e:
            print(f"[{t}] erreur: {e}")
    driver.quit()

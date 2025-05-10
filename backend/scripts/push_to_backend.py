import sys, os, time, json, pymongo
from datetime import datetime
from dotenv import load_dotenv
from bson import ObjectId
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# 1) Charger .env et MongoDB
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path)
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["walletDB"]
users_col = db["users"]

# 2) Configurer Selenium headless
options = Options()
options.headless = True
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("--window-size=1920,1080")
options.add_argument(
    "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
driver = webdriver.Chrome(options=options)

def fetch_from_browser(ticker):
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        driver.get(url)
        time.sleep(2)
        pre = driver.find_element("tag name", "pre").text
        meta = json.loads(pre)["chart"]["result"][0]["meta"]

        o = meta.get("regularMarketOpen") or meta.get("previousClose", 0)
        c = meta.get("regularMarketPrice", 0)
        h = meta.get("regularMarketDayHigh", 0)
        l = meta.get("regularMarketDayLow", 0)
        v = meta.get("regularMarketVolume", 0)

        return {
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "open": round(o, 2),
            "close": round(c, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "volume": int(v),
        }
    except Exception as e:
        print(f"❌ Erreur Selenium pour {ticker} : {e}")
        return None

def update_portfolio(user_id):
    user = users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        print(f"❌ Utilisateur {user_id} non trouvé.")
        return

    portfolio = user.get("portfolio", [])
    changed = False

    for idx, stock in enumerate(portfolio):
        ticker = stock.get("ticker")
        if not ticker:
            continue
        fresh = fetch_from_browser(ticker)
        if not fresh:
            continue

        # Mettre à jour uniquement les champs de prix/date
        for key, val in fresh.items():
            if stock.get(key) != val:
                portfolio[idx][key] = val
                changed = True

    if changed:
        users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "portfolio": portfolio,
                "updatedAt": datetime.utcnow()
            }}
        )
        print(f"✅ Portefeuille mis à jour pour userId={user_id}")
    else:
        print(f"ℹ️ Pas de modification pour userId={user_id}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python update_user_portfolio.py <userId>")
        sys.exit(1)
    update_portfolio(sys.argv[1])
    driver.quit()

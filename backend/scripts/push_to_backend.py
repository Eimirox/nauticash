from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time
import json
import requests
from datetime import datetime
from dotenv import load_dotenv
import os
import pymongo

# Charger les variables d'environnement
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

# Connexion MongoDB
MONGO_URI = os.getenv("MONGO_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["walletDB"]
collection = db["prices"]

# Configuration API backend
API_URL = "http://localhost:5000/api/stocks/update"
TICKERS = ["GOOGL", "TSLA", "MRK"]  # Ajouter plusieurs tickers à traiter

# Configuration Selenium headless (sans interface graphique)
options = Options()
options.headless = True
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--window-size=1920,1080")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")

driver = webdriver.Chrome(options=options)

# Fonction pour récupérer les données via Selenium
def fetch_from_browser(ticker):
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        print(f"🌐 Ouverture de {url} dans navigateur headless")
        driver.get(url)
        time.sleep(3)  # Attente pour laisser le temps à la page de se charger
        pre = driver.find_element("tag name", "pre").text  # Récupère la balise <pre> contenant les données
        data = json.loads(pre)

        meta = data["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice", 0)
        currency = meta.get("currency", "USD")
        open_price = meta.get("regularMarketOpen", 0)  # Peut-être 0 si Yahoo ne le fournit pas
        high = meta.get("regularMarketDayHigh", 0)
        low = meta.get("regularMarketDayLow", 0)
        volume = meta.get("regularMarketVolume", 0)

        # Si open_price est 0, on tente d'utiliser previousClose
        if open_price == 0:
            open_price = meta.get("previousClose", (high + low) / 2)

        return {
            "symbol": ticker,
            "date": datetime.today().strftime("%Y-%m-%d"),
            "open": round(open_price, 2) if open_price else 0,
            "close": round(price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "volume": int(volume) if volume else 0,
            "currency": currency,
            "country": "US"
        }

    except Exception as e:
        print(f"❌ Erreur navigateur pour {ticker} : {e}")
        return None

# Fonction d'update ou d'insertion des données dans MongoDB
def update_or_insert(donnees):
    try:
        # Vérifier si le ticker et la date existent déjà
        existing_data = collection.find_one({"symbol": donnees["symbol"], "date": donnees["date"]})

        if existing_data:
            # Si le ticker et la date existent, faire un update
            collection.update_one(
                {"_id": existing_data["_id"]},
                {"$set": donnees}
            )
            print(f"✅ Donnée mise à jour pour {donnees['symbol']} du {donnees['date']}")
        else:
            # Si le ticker et la date n'existent pas, faire une insertion
            collection.insert_one(donnees)
            print(f"✅ Donnée insérée pour {donnees['symbol']} du {donnees['date']}")

    except Exception as e:
        print(f"❌ Erreur d'update ou insertion pour {donnees['symbol']} : {e}")

# Exécution du script pour plusieurs tickers
if __name__ == "__main__":
    for ticker in TICKERS:
        data = fetch_from_browser(ticker)
        if data:
            update_or_insert(data)
    driver.quit()

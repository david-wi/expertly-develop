import asyncio
import logging
from typing import Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


async def get_company_data(ticker: str) -> dict:
    """Fetch company financial data from yfinance. Runs in thread pool since yfinance is sync."""
    def _fetch():
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info

        return {
            "current_pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "market_cap": info.get("marketCap"),
            "revenue": info.get("totalRevenue"),
            "gross_margin": info.get("grossMargins"),
            "operating_margin": info.get("operatingMargins"),
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "exchange": info.get("exchange"),
            "name": info.get("shortName") or info.get("longName"),
            "description": info.get("longBusinessSummary", ""),
            "sec_cik": None,  # yfinance doesn't provide CIK
        }

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)


async def get_historical_pe(ticker: str, months_ago: int = 12) -> Optional[float]:
    """Calculate historical P/E from a year ago."""
    def _fetch():
        import yfinance as yf
        stock = yf.Ticker(ticker)

        end_date = datetime.now() - timedelta(days=months_ago * 30)
        start_date = end_date - timedelta(days=30)

        hist = stock.history(start=start_date.strftime("%Y-%m-%d"), end=end_date.strftime("%Y-%m-%d"))
        if hist.empty:
            return None

        avg_price = hist["Close"].mean()
        info = stock.info
        eps = info.get("trailingEps")
        if eps and eps > 0:
            return round(avg_price / eps, 2)
        return None

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logger.warning(f"Failed to get historical PE for {ticker}: {e}")
        return None


async def get_price_change_1yr(ticker: str) -> Optional[float]:
    """Calculate 1-year price change percentage."""
    def _fetch():
        import yfinance as yf
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y")
        if hist.empty or len(hist) < 2:
            return None
        first_price = hist["Close"].iloc[0]
        last_price = hist["Close"].iloc[-1]
        if first_price > 0:
            return round(((last_price - first_price) / first_price) * 100, 2)
        return None

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logger.warning(f"Failed to get price change for {ticker}: {e}")
        return None


async def search_ticker(query: str) -> list[dict]:
    """Search for tickers matching a query."""
    def _fetch():
        import yfinance as yf
        results = []
        # Try direct ticker lookup first
        try:
            stock = yf.Ticker(query.upper())
            info = stock.info
            if info.get("shortName"):
                results.append({
                    "ticker": query.upper(),
                    "name": info.get("shortName", ""),
                    "exchange": info.get("exchange"),
                    "sector": info.get("sector"),
                })
        except Exception:
            pass
        return results

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logger.warning(f"Ticker search failed for {query}: {e}")
        return []

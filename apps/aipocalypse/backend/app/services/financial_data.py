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


async def get_price_history(ticker: str, period: str = "1y") -> list[dict]:
    """Fetch 1 year of daily close prices, downsampled to ~weekly if >100 points."""
    def _fetch():
        import yfinance as yf
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        if hist.empty:
            return []

        # Build list of date/close points
        points = []
        for date, row in hist.iterrows():
            points.append({
                "date": date.strftime("%Y-%m-%d"),
                "close": round(float(row["Close"]), 2),
            })

        # Downsample to ~weekly if too many points
        if len(points) > 100:
            step = max(1, len(points) // 52)
            sampled = points[::step]
            # Always include the last point
            if sampled[-1] != points[-1]:
                sampled.append(points[-1])
            return sampled

        return points

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logger.warning(f"Failed to get price history for {ticker}: {e}")
        return []


async def get_analyst_data(ticker: str) -> Optional[dict]:
    """Fetch analyst consensus data from yfinance."""
    def _fetch():
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info

        fields = [
            "targetMeanPrice", "targetHighPrice", "targetLowPrice",
            "recommendationKey", "recommendationMean",
            "numberOfAnalystOpinions", "currentPrice",
        ]
        result = {}
        for f in fields:
            result[f] = info.get(f)

        # Only return if we have at least some analyst data
        if result.get("targetMeanPrice") or result.get("recommendationKey"):
            return result
        return None

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logger.warning(f"Failed to get analyst data for {ticker}: {e}")
        return None


async def get_key_metrics(ticker: str) -> Optional[dict]:
    """Fetch key financial metrics from yfinance."""
    def _fetch():
        import yfinance as yf
        stock = yf.Ticker(ticker)
        info = stock.info

        fields = [
            "trailingPE", "forwardPE", "marketCap", "totalRevenue",
            "ebitda", "totalCash", "totalDebt", "freeCashflow",
            "returnOnEquity", "dividendYield", "beta", "enterpriseValue",
            "priceToBook", "priceToSalesTrailing12Months",
            "grossMargins", "operatingMargins", "profitMargins",
            "revenueGrowth", "earningsGrowth",
        ]
        result = {}
        for f in fields:
            val = info.get(f)
            if val is not None:
                result[f] = val

        return result if result else None

    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _fetch)
    except Exception as e:
        logger.warning(f"Failed to get key metrics for {ticker}: {e}")
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

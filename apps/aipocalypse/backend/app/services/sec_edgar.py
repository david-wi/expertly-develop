import httpx
import logging
import re
from typing import Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://data.sec.gov"
EFTS_URL = "https://efts.sec.gov/LATEST/search-index"
FULL_TEXT_URL = "https://efts.sec.gov/LATEST"


async def get_user_agent() -> str:
    """Get SEC EDGAR user agent from settings."""
    from app.database import get_database
    from app.config import get_settings
    db = get_database()
    settings_doc = await db.app_settings.find_one({})
    config = get_settings()
    return (settings_doc or {}).get("sec_edgar_user_agent") or config.sec_edgar_user_agent or "AipocalypseFund research@example.com"


async def search_company(query: str) -> list[dict]:
    """Search EDGAR for a company by name or ticker."""
    user_agent = await get_user_agent()
    async with httpx.AsyncClient() as client:
        # Try full-text search
        resp = await client.get(
            f"{FULL_TEXT_URL}/search-index?q={query}&dateRange=custom&startdt=2020-01-01&forms=10-K",
            headers={"User-Agent": user_agent},
            timeout=15.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            results = []
            seen = set()
            for hit in data.get("hits", {}).get("hits", [])[:10]:
                source = hit.get("_source", {})
                cik = source.get("entity_id", "")
                if cik and cik not in seen:
                    seen.add(cik)
                    results.append({
                        "cik": cik,
                        "name": source.get("entity_name", ""),
                        "ticker": "",
                    })
            return results
    return []


async def get_company_filings(cik: str, form_types: list[str] = None) -> list[dict]:
    """Get recent filings for a company from EDGAR."""
    if form_types is None:
        form_types = ["10-K", "10-Q"]

    user_agent = await get_user_agent()
    # Pad CIK to 10 digits
    cik_padded = cik.zfill(10)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/submissions/CIK{cik_padded}.json",
            headers={"User-Agent": user_agent},
            timeout=15.0,
        )
        if resp.status_code != 200:
            logger.warning(f"Failed to fetch filings for CIK {cik}: {resp.status_code}")
            return []

        data = resp.json()
        filings = []
        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        accessions = recent.get("accessionNumber", [])
        dates = recent.get("filingDate", [])
        primary_docs = recent.get("primaryDocument", [])

        for i, form in enumerate(forms):
            if form in form_types and i < len(accessions):
                filings.append({
                    "form": form,
                    "accession_number": accessions[i],
                    "filing_date": dates[i] if i < len(dates) else "",
                    "primary_document": primary_docs[i] if i < len(primary_docs) else "",
                })
                if len(filings) >= 5:
                    break

        return filings


async def get_filing_text(accession_number: str, cik: str) -> Optional[str]:
    """Download a filing's HTML content."""
    user_agent = await get_user_agent()
    cik_padded = cik.zfill(10)
    accession_clean = accession_number.replace("-", "")

    async with httpx.AsyncClient() as client:
        # First get the filing index
        index_url = f"{BASE_URL}/Archives/edgar/data/{cik_padded}/{accession_clean}/{accession_number}-index.htm"
        resp = await client.get(
            index_url,
            headers={"User-Agent": user_agent},
            timeout=15.0,
        )
        if resp.status_code != 200:
            return None

        # Parse to find the main document
        soup = BeautifulSoup(resp.text, "lxml")
        for link in soup.find_all("a"):
            href = link.get("href", "")
            if href.endswith(".htm") and "10-" in link.get_text().lower():
                doc_url = f"{BASE_URL}{href}" if href.startswith("/") else f"{BASE_URL}/Archives/edgar/data/{cik_padded}/{accession_clean}/{href}"
                doc_resp = await client.get(
                    doc_url,
                    headers={"User-Agent": user_agent},
                    timeout=30.0,
                )
                if doc_resp.status_code == 200:
                    return doc_resp.text
    return None


def extract_key_sections(filing_html: str) -> dict:
    """Extract key sections from a 10-K/10-Q filing HTML."""
    soup = BeautifulSoup(filing_html, "lxml")
    text = soup.get_text(separator="\n")

    sections = {
        "business": "",
        "risk_factors": "",
        "mda": "",
    }

    # Common section header patterns
    patterns = {
        "business": [
            r"(?i)item\s*1[\.\s]*[-–—]?\s*business",
            r"(?i)item\s*1\.\s+business",
        ],
        "risk_factors": [
            r"(?i)item\s*1a[\.\s]*[-–—]?\s*risk\s+factors",
            r"(?i)item\s*1a\.\s+risk\s+factors",
        ],
        "mda": [
            r"(?i)item\s*7[\.\s]*[-–—]?\s*management",
            r"(?i)item\s*7\.\s+management",
        ],
    }

    end_patterns = {
        "business": [r"(?i)item\s*1a", r"(?i)item\s*2"],
        "risk_factors": [r"(?i)item\s*1b", r"(?i)item\s*2"],
        "mda": [r"(?i)item\s*7a", r"(?i)item\s*8"],
    }

    max_words = 4000

    for section, start_pats in patterns.items():
        for pat in start_pats:
            match = re.search(pat, text)
            if match:
                start_pos = match.start()
                # Find end
                end_pos = len(text)
                for end_pat in end_patterns.get(section, []):
                    end_match = re.search(end_pat, text[start_pos + 100:])
                    if end_match:
                        end_pos = min(end_pos, start_pos + 100 + end_match.start())
                        break

                section_text = text[start_pos:end_pos].strip()
                # Truncate to max words
                words = section_text.split()
                if len(words) > max_words:
                    section_text = " ".join(words[:max_words]) + "\n\n[Truncated]"
                sections[section] = section_text
                break

    return sections

import logging
from app.database import get_database

logger = logging.getLogger(__name__)


async def ensure_indexes() -> None:
    db = get_database()

    # Companies: ticker should be unique
    await db.companies.create_index("ticker", unique=True, sparse=True)
    await db.companies.create_index("industry_id")
    await db.companies.create_index("latest_signal")

    # Industries: slug should be unique
    await db.industries.create_index("slug", unique=True)
    await db.industries.create_index("parent_id")
    await db.industries.create_index("level")

    # Hypotheses
    await db.hypotheses.create_index("status")

    # Reports
    await db.research_reports.create_index("company_id")
    await db.research_reports.create_index([("company_id", 1), ("version", -1)])

    # Queue
    await db.research_queue.create_index("status")
    await db.research_queue.create_index([("status", 1), ("priority", -1), ("created_at", 1)])

    logger.info("Database indexes ensured")


async def seed_database() -> None:
    db = get_database()

    # Only seed if collections are empty
    industry_count = await db.industries.count_documents({})
    if industry_count > 0:
        logger.info("Database already seeded, skipping")
        return

    logger.info("Seeding database with initial data...")

    # Seed industries (sectors, industries, sub-industries)
    sectors = [
        {"name": "Information Technology", "slug": "it", "level": 0, "icon": "Monitor", "description": "Technology companies including software, hardware, and IT services", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Financials", "slug": "financials", "level": 0, "icon": "DollarSign", "description": "Banks, insurance, asset management, and financial services", "sort_order": 2, "is_system": True, "company_count": 0},
        {"name": "Healthcare", "slug": "healthcare", "level": 0, "icon": "Heart", "description": "Pharmaceuticals, biotechnology, medical devices, and healthcare services", "sort_order": 3, "is_system": True, "company_count": 0},
        {"name": "Industrials", "slug": "industrials", "level": 0, "icon": "Factory", "description": "Aerospace, defense, machinery, construction, and industrial services", "sort_order": 4, "is_system": True, "company_count": 0},
        {"name": "Consumer Discretionary", "slug": "consumer-discretionary", "level": 0, "icon": "ShoppingCart", "description": "Retail, automotive, media, entertainment, and consumer services", "sort_order": 5, "is_system": True, "company_count": 0},
        {"name": "Consumer Staples", "slug": "consumer-staples", "level": 0, "icon": "Package", "description": "Food, beverages, tobacco, and household products", "sort_order": 6, "is_system": True, "company_count": 0},
        {"name": "Communication Services", "slug": "communication-services", "level": 0, "icon": "Radio", "description": "Telecom, media, entertainment, and interactive media", "sort_order": 7, "is_system": True, "company_count": 0},
        {"name": "Energy", "slug": "energy", "level": 0, "icon": "Zap", "description": "Oil, gas, and energy equipment and services", "sort_order": 8, "is_system": True, "company_count": 0},
        {"name": "Materials", "slug": "materials", "level": 0, "icon": "Layers", "description": "Chemicals, construction materials, metals, and mining", "sort_order": 9, "is_system": True, "company_count": 0},
        {"name": "Real Estate", "slug": "real-estate", "level": 0, "icon": "Home", "description": "REITs, real estate management, and development", "sort_order": 10, "is_system": True, "company_count": 0},
        {"name": "Utilities", "slug": "utilities", "level": 0, "icon": "Plug", "description": "Electric, gas, water utilities and independent power producers", "sort_order": 11, "is_system": True, "company_count": 0},
    ]

    result = await db.industries.insert_many(sectors)
    sector_ids = {s["slug"]: str(rid) for s, rid in zip(sectors, result.inserted_ids)}

    # Industries (level 1) under key sectors
    industries = [
        # IT sub-industries
        {"name": "Software", "slug": "software", "parent_id": sector_ids["it"], "level": 1, "icon": "Code", "description": "Application and systems software", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "IT Services & Consulting", "slug": "it-services", "parent_id": sector_ids["it"], "level": 1, "icon": "Briefcase", "description": "IT consulting, outsourcing, and system integration", "sort_order": 2, "is_system": True, "company_count": 0},
        {"name": "Semiconductors", "slug": "semiconductors", "parent_id": sector_ids["it"], "level": 1, "icon": "Cpu", "description": "Chip design, fabrication, and equipment", "sort_order": 3, "is_system": True, "company_count": 0},
        {"name": "Hardware & Equipment", "slug": "hardware", "parent_id": sector_ids["it"], "level": 1, "icon": "HardDrive", "description": "Computers, peripherals, and networking equipment", "sort_order": 4, "is_system": True, "company_count": 0},
        {"name": "Cloud Infrastructure", "slug": "cloud-infrastructure", "parent_id": sector_ids["it"], "level": 1, "icon": "Cloud", "description": "Cloud computing, data centers, and hosting services", "sort_order": 5, "is_system": True, "company_count": 0},
        # Financials
        {"name": "Banks", "slug": "banks", "parent_id": sector_ids["financials"], "level": 1, "icon": "Landmark", "description": "Commercial and investment banks", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Insurance", "slug": "insurance", "parent_id": sector_ids["financials"], "level": 1, "icon": "Shield", "description": "Property, casualty, life, and health insurance", "sort_order": 2, "is_system": True, "company_count": 0},
        {"name": "Asset Management", "slug": "asset-management", "parent_id": sector_ids["financials"], "level": 1, "icon": "PieChart", "description": "Mutual funds, ETFs, and investment management", "sort_order": 3, "is_system": True, "company_count": 0},
        {"name": "Fintech", "slug": "fintech", "parent_id": sector_ids["financials"], "level": 1, "icon": "Smartphone", "description": "Financial technology and payments", "sort_order": 4, "is_system": True, "company_count": 0},
        # Healthcare
        {"name": "Pharmaceuticals", "slug": "pharmaceuticals", "parent_id": sector_ids["healthcare"], "level": 1, "icon": "Pill", "description": "Drug development and manufacturing", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Biotechnology", "slug": "biotechnology", "parent_id": sector_ids["healthcare"], "level": 1, "icon": "Dna", "description": "Biotech research and therapeutics", "sort_order": 2, "is_system": True, "company_count": 0},
        {"name": "Medical Devices", "slug": "medical-devices", "parent_id": sector_ids["healthcare"], "level": 1, "icon": "Stethoscope", "description": "Medical equipment and devices", "sort_order": 3, "is_system": True, "company_count": 0},
        {"name": "Healthcare Services", "slug": "healthcare-services", "parent_id": sector_ids["healthcare"], "level": 1, "icon": "Hospital", "description": "Healthcare providers and services", "sort_order": 4, "is_system": True, "company_count": 0},
        # Industrials
        {"name": "Staffing & Recruitment", "slug": "staffing", "parent_id": sector_ids["industrials"], "level": 1, "icon": "Users", "description": "Staffing agencies and recruitment firms", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Professional Services", "slug": "professional-services", "parent_id": sector_ids["industrials"], "level": 1, "icon": "GraduationCap", "description": "Consulting, accounting, and professional services", "sort_order": 2, "is_system": True, "company_count": 0},
        {"name": "Aerospace & Defense", "slug": "aerospace-defense", "parent_id": sector_ids["industrials"], "level": 1, "icon": "Plane", "description": "Aircraft, defense systems, and space", "sort_order": 3, "is_system": True, "company_count": 0},
        # Communication Services
        {"name": "Interactive Media", "slug": "interactive-media", "parent_id": sector_ids["communication-services"], "level": 1, "icon": "Globe", "description": "Search engines, social media, and digital platforms", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Entertainment", "slug": "entertainment", "parent_id": sector_ids["communication-services"], "level": 1, "icon": "Film", "description": "Movies, TV, gaming, and music", "sort_order": 2, "is_system": True, "company_count": 0},
        # Consumer Discretionary
        {"name": "E-Commerce", "slug": "ecommerce", "parent_id": sector_ids["consumer-discretionary"], "level": 1, "icon": "ShoppingBag", "description": "Online retail and marketplaces", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Automotive", "slug": "automotive", "parent_id": sector_ids["consumer-discretionary"], "level": 1, "icon": "Car", "description": "Vehicle manufacturers and parts", "sort_order": 2, "is_system": True, "company_count": 0},
    ]

    if industries:
        result = await db.industries.insert_many(industries)
        industry_ids = {ind["slug"]: str(rid) for ind, rid in zip(industries, result.inserted_ids)}

    # Sub-industries (level 2) for key areas
    sub_industries = [
        {"name": "SaaS / Cloud Software", "slug": "saas", "parent_id": industry_ids.get("software"), "level": 2, "icon": "Cloud", "description": "Software-as-a-Service applications", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Enterprise Software", "slug": "enterprise-software", "parent_id": industry_ids.get("software"), "level": 2, "icon": "Building", "description": "Large-scale business applications", "sort_order": 2, "is_system": True, "company_count": 0},
        {"name": "Cybersecurity", "slug": "cybersecurity", "parent_id": industry_ids.get("software"), "level": 2, "icon": "Lock", "description": "Security software and services", "sort_order": 3, "is_system": True, "company_count": 0},
        {"name": "DevTools & Infrastructure", "slug": "devtools", "parent_id": industry_ids.get("software"), "level": 2, "icon": "Wrench", "description": "Developer tools, CI/CD, and infrastructure software", "sort_order": 4, "is_system": True, "company_count": 0},
        {"name": "System Integrators", "slug": "system-integrators", "parent_id": industry_ids.get("it-services"), "level": 2, "icon": "Link", "description": "Large-scale IT system integration", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "IT Outsourcing", "slug": "it-outsourcing", "parent_id": industry_ids.get("it-services"), "level": 2, "icon": "ExternalLink", "description": "Outsourced IT services and BPO", "sort_order": 2, "is_system": True, "company_count": 0},
        {"name": "AI Chips", "slug": "ai-chips", "parent_id": industry_ids.get("semiconductors"), "level": 2, "icon": "Cpu", "description": "GPU and AI accelerator chips", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Hyperscale Cloud", "slug": "hyperscale-cloud", "parent_id": industry_ids.get("cloud-infrastructure"), "level": 2, "icon": "Server", "description": "Major cloud platform providers", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Drug Discovery", "slug": "drug-discovery", "parent_id": industry_ids.get("biotechnology"), "level": 2, "icon": "FlaskConical", "description": "AI-driven and traditional drug discovery", "sort_order": 1, "is_system": True, "company_count": 0},
        {"name": "Temporary Staffing", "slug": "temporary-staffing", "parent_id": industry_ids.get("staffing"), "level": 2, "icon": "Clock", "description": "Temporary and contract staffing", "sort_order": 1, "is_system": True, "company_count": 0},
    ]

    if sub_industries:
        await db.industries.insert_many(sub_industries)

    # Seed hypotheses
    hypotheses = [
        {
            "title": "AI Coding Tools Devastate IT Services & System Integrators",
            "description": "AI coding assistants (Copilot, Cursor, Claude Code) will dramatically reduce the need for large teams of developers, directly threatening the billable-hours model of IT service companies and system integrators. Companies like Accenture, Infosys, Wipro, and Cognizant face 30-50% revenue compression as clients need fewer developers for the same output.",
            "thesis_type": "disruption",
            "affected_industry_ids": [],
            "affected_company_type_ids": [],
            "impact_direction": "negative",
            "confidence_level": 85,
            "tags": ["ai-coding", "it-services", "outsourcing", "labor-disruption"],
            "status": "active",
            "supporting_evidence": [
                "GitHub Copilot reports 55% faster task completion in studies",
                "Major tech companies already reducing engineering headcount",
                "IT services firms derive 70%+ revenue from developer staffing/consulting",
                "Claude Code and similar tools can handle complex multi-file changes autonomously"
            ],
            "counter_arguments": [
                "Enterprise IT projects require domain knowledge beyond coding",
                "Regulatory and compliance work may resist automation",
                "Companies may redirect resources to AI transformation consulting"
            ]
        },
        {
            "title": "SaaS Applications Vulnerable to AI Duplication",
            "description": "Many SaaS applications with relatively simple functionality (project management, CRM, analytics dashboards) can be rapidly replicated by AI coding tools, destroying their moat. Companies with thin feature sets and high valuations face existential risk as AI enables rapid custom software development.",
            "thesis_type": "disruption",
            "affected_industry_ids": [],
            "affected_company_type_ids": [],
            "impact_direction": "negative",
            "confidence_level": 70,
            "tags": ["saas", "software-moat", "ai-replication", "valuation-compression"],
            "status": "active",
            "supporting_evidence": [
                "AI tools can scaffold entire applications in hours",
                "Many SaaS products have simple CRUD architectures easily replicated",
                "Open-source alternatives proliferating faster than ever",
                "Enterprise buyers increasingly building internal tools with AI assistance"
            ],
            "counter_arguments": [
                "Network effects and data moats protect some SaaS companies",
                "Enterprise switching costs remain high",
                "Integration ecosystems create lock-in",
                "Best SaaS companies will incorporate AI to deepen their moat"
            ]
        },
        {
            "title": "AI Infrastructure Boom Benefits Chip Makers & Cloud Providers",
            "description": "The AI revolution requires massive compute infrastructure investment, creating a secular tailwind for semiconductor companies (NVIDIA, AMD, Broadcom) and hyperscale cloud providers (AWS, Azure, GCP). This is the 'picks and shovels' play of the AI gold rush.",
            "thesis_type": "secular_trend",
            "affected_industry_ids": [],
            "affected_company_type_ids": [],
            "impact_direction": "positive",
            "confidence_level": 90,
            "tags": ["ai-infrastructure", "semiconductors", "cloud", "capex-cycle"],
            "status": "active",
            "supporting_evidence": [
                "NVIDIA data center revenue grew 400%+ YoY in 2024",
                "Hyperscaler capex plans for AI total $200B+ annually",
                "AI model training costs doubling every 6-9 months",
                "Enterprise AI adoption still in early innings"
            ],
            "counter_arguments": [
                "Capex cycle could lead to oversupply",
                "More efficient models may reduce compute needs",
                "Custom AI chips from cloud providers may reduce NVIDIA dependency",
                "Valuations already reflect significant growth expectations"
            ]
        },
        {
            "title": "AI Accelerates Drug Discovery, Benefits Biotech",
            "description": "AI and machine learning are dramatically reducing the time and cost of drug discovery, from target identification to lead optimization. Biotech companies leveraging AI-first approaches will have significant advantages in pipeline development speed and cost efficiency.",
            "thesis_type": "secular_trend",
            "affected_industry_ids": [],
            "affected_company_type_ids": [],
            "impact_direction": "positive",
            "confidence_level": 65,
            "tags": ["drug-discovery", "biotech", "ai-science", "healthcare"],
            "status": "active",
            "supporting_evidence": [
                "AlphaFold and similar tools have revolutionized protein structure prediction",
                "AI-discovered drug candidates entering clinical trials",
                "Traditional drug development costs $2B+ and takes 10+ years",
                "AI can screen millions of compounds in silico"
            ],
            "counter_arguments": [
                "Clinical trial success rates remain low regardless of discovery method",
                "Regulatory approval timelines unchanged by AI",
                "Many AI biotech companies yet to produce approved drugs",
                "Biology remains complex and unpredictable"
            ]
        },
        {
            "title": "Staffing Firms Face Demand Destruction from AI",
            "description": "AI automation will significantly reduce demand for temporary and contract workers across white-collar roles (accounting, legal, data entry, customer service). Staffing firms face structural decline as AI handles work previously done by temp workers.",
            "thesis_type": "disruption",
            "affected_industry_ids": [],
            "affected_company_type_ids": [],
            "impact_direction": "negative",
            "confidence_level": 75,
            "tags": ["staffing", "labor-market", "automation", "white-collar"],
            "status": "active",
            "supporting_evidence": [
                "AI chatbots replacing call center workers at scale",
                "AI document processing reducing need for data entry temps",
                "Legal AI tools reducing paralegal staffing needs",
                "Accounting automation reducing bookkeeping demand"
            ],
            "counter_arguments": [
                "Blue-collar and skilled trades staffing unaffected",
                "New AI-related roles create different staffing needs",
                "Transition period may last years, giving firms time to adapt",
                "Staffing firms may pivot to AI implementation consulting"
            ]
        },
    ]

    await db.hypotheses.insert_many(hypotheses)

    # Seed default app settings
    existing_settings = await db.app_settings.find_one({})
    if not existing_settings:
        await db.app_settings.insert_one({
            "anthropic_api_key": "",
            "sec_edgar_user_agent": "",
            "queue_batch_size": 5,
            "default_model": "claude-sonnet-4-20250514",
        })

    logger.info("Database seeded successfully")

export interface PageHelpData {
  title: string
  description: string
  features: string[]
  howToUse: string[]
  tips?: string[]
}

export const pageHelpContent: Record<string, PageHelpData> = {
  dashboard: {
    title: 'Dashboard',
    description:
      'Your command center showing open work items, at-risk shipments, and today\'s pickups and deliveries at a glance.',
    features: [
      'See open work items that need your attention',
      'Monitor at-risk shipments before they become problems',
      'Track today\'s pickups and deliveries',
      'Jump to common tasks with quick actions',
    ],
    howToUse: [
      'Click any stat card to drill into that area (e.g., click "At-Risk Shipments" to see the filtered list)',
      'Use the Quick Actions panel on the right to start common workflows',
      'Review Urgent Items to see overdue tasks and high-priority work',
    ],
    tips: [
      'The dashboard refreshes automatically -- check it first thing in the morning to plan your day',
      'At-risk shipments are flagged proactively so you can address issues before they escalate',
    ],
  },

  inbox: {
    title: 'Inbox',
    description:
      'Your unified work queue where all tasks that need your attention land in one place -- quote requests, check calls due, carrier messages, exceptions, and approvals.',
    features: [
      'View all pending work items across every category',
      'Browse and triage incoming emails with AI classification',
      'Filter by type: quotes, dispatch, check calls, and more',
      'Snooze items to revisit later or mark them complete',
    ],
    howToUse: [
      'Switch between the Work Items tab and the Emails tab at the top',
      'Use filter buttons to narrow down to a specific type of work',
      'Click the snooze icon to push an item to tomorrow morning',
      'Click the checkmark to mark an item complete and remove it from the queue',
    ],
    tips: [
      'Overdue items automatically surface to the top so you never miss a deadline',
      'In the Emails tab, AI summaries help you quickly understand each message without reading the full text',
    ],
  },

  'quote-requests': {
    title: 'Quote Requests',
    description:
      'Where inbound rate requests land -- from emails, phone calls, or the customer portal. AI automatically extracts origin, destination, dates, equipment type, and weight from email text.',
    features: [
      'Paste raw email text and let AI parse shipment details',
      'Review AI-extracted fields shown with confidence scores',
      'Correct any fields the AI got wrong before creating a formal quote',
      'Track requests through new, in-progress, and quoted statuses',
    ],
    howToUse: [
      'Click "New Request" to paste an email or enter details manually',
      'After creating a request, AI extraction runs automatically',
      'Review the extracted data (origin, destination, dates, equipment) and fix anything that looks off',
      'Click "Create Quote" to move to the Quote Builder with pre-filled details',
    ],
    tips: [
      'The confidence bar shows how certain the AI is about each extracted field -- pay extra attention to low-confidence fields',
      'Missing fields are highlighted in amber so you know what to fill in manually',
    ],
  },

  'quote-builder': {
    title: 'Quote Builder',
    description:
      'Build and price a formal quote to send to a customer. Add line items, see real-time margin calculations, and send directly or submit for approval.',
    features: [
      'Add line items: base freight, fuel surcharge, accessorials (detention, lumper, etc.)',
      'Real-time margin calculation as you adjust pricing',
      'Auto-apply customer-specific contracted rates and volume discounts',
      'Version history -- every revision is saved and can be reverted',
      'Submit for approval if the quote exceeds margin thresholds',
    ],
    howToUse: [
      'Add or edit line items in the main panel -- each has a description and price',
      'Set the estimated cost to see your margin update in real time',
      'Use "Auto-Apply Customer Rates" to pull in contracted pricing',
      'Click "Draft Email with AI" to generate a ready-to-send quote email',
      'Enter the customer email and click Send to deliver the quote',
    ],
    tips: [
      'The margin guide on the right shows target ranges: green (20%+) is excellent, red (<10%) needs review',
      'Use version history to compare how pricing changed over time',
    ],
  },

  shipments: {
    title: 'Shipments',
    description:
      'Master list of all shipments across every status. Filter, search, bulk import, and manage recurring load templates from one place.',
    features: [
      'Filter by status: booked, pending pickup, in transit, delivered',
      'Toggle "At Risk Only" to see shipments that need immediate attention',
      'Bulk import shipments via CSV upload with AI-powered column mapping',
      'Create and use load templates for recurring lanes',
      'LTL consolidation suggestions to save costs',
    ],
    howToUse: [
      'Use the status filter buttons to narrow the list',
      'Click any shipment row to view its full details',
      'Click "Bulk Import" to upload a CSV file -- AI will map columns automatically',
      'Click "Templates" to create or book from saved load templates',
      'Click "Consolidate" to see AI-detected opportunities to combine smaller shipments',
    ],
    tips: [
      'Save column mappings when importing CSVs so you can reuse them for the same customer format',
      'Recurring templates can be set to daily, weekly, biweekly, or monthly frequency',
    ],
  },

  'shipment-detail': {
    title: 'Shipment Detail',
    description:
      'Complete view of a single shipment: route, stops, pricing, carrier, documents, and tracking timeline. Manage the full lifecycle from booking through delivery.',
    features: [
      'View load details, stops, financials, and carrier info',
      'Add check calls and tracking updates in the Tracking tab',
      'Upload and manage documents (BOL, POD, rate confirmations) in the Documents tab',
      'View the full communication thread in the Conversation tab',
      'Generate Bill of Lading, capture Proof of Delivery, split shipments, and assign equipment',
    ],
    howToUse: [
      'Use the tabs (Overview, Tracking, Documents, Conversation) to navigate between sections',
      'Click status transition buttons (e.g., "Mark Picked Up", "Mark Delivered") to advance the shipment',
      'Use "Generate BOL" to create a Bill of Lading from the shipment data',
      'Use "Split" to break an overweight shipment into smaller child shipments',
      'Click "Template" to save this shipment as a reusable load template',
    ],
    tips: [
      'After delivery, click "Create Invoice" to immediately generate a customer invoice',
      'The fuel surcharge calculator in the Equipment panel uses current DOE fuel prices',
    ],
  },

  'dispatch-board': {
    title: 'Dispatch Board',
    description:
      'Visual Kanban board for assigning carriers to loads. Three columns track shipments from needing a carrier through tendering to dispatched.',
    features: [
      'Kanban view: Needs Carrier, Tendered, and Dispatched columns',
      'AI-powered carrier suggestions ranked by lane history, on-time rate, and cost',
      'Live margin calculator updates as you set the tender rate',
      'AI Auto-Assign for hands-off dispatching when confidence is high',
      'Driver Map view showing real-time GPS locations',
    ],
    howToUse: [
      'Click a shipment card in any column to open the carrier assignment panel',
      'Review AI recommendations -- the "Best Match" badge highlights the top carrier',
      'Set an offer rate and click "Send Tender" to send the rate offer to a carrier',
      'Use "AI Auto-Assign Carrier" for high-confidence matches',
      'Switch to the "Driver Map" view to see where your drivers are in real time',
    ],
    tips: [
      'The match score combines lane history, on-time percentage, and cost competitiveness',
      'If auto-assign confidence is below the threshold, it will pre-fill the best suggestion for manual review',
    ],
  },

  customers: {
    title: 'Customers',
    description:
      'Directory of all your shipper and customer accounts. See status, contact info, and shipment volume at a glance.',
    features: [
      'View all customers with their current status (active, inactive, credit hold)',
      'Add new customers with contact and billing details',
      'Click any customer to view their full profile',
      'Quick access to email and phone for each customer',
    ],
    howToUse: [
      'Click "Add Customer" to create a new customer record',
      'Click any customer row to open their detailed profile',
      'Use the status badges to quickly identify customers on credit hold',
    ],
    tips: [
      'Keep customer billing emails up to date -- invoices are sent to this address',
      'Customers on credit hold cannot have new shipments booked until the hold is cleared',
    ],
  },

  'customer-detail': {
    title: 'Customer Detail',
    description:
      'Full customer profile including contacts, billing info, facilities, pricing rules, and shipment history.',
    features: [
      'Manage multiple contacts per customer with roles and primary designation',
      'Track customer facilities (warehouses, distribution centers)',
      'Set up pricing playbooks with customer-specific rates and discounts',
      'View shipment history and revenue metrics',
    ],
    howToUse: [
      'Use the tabs (Overview, Contacts, Facilities, Playbooks, Shipments) to navigate',
      'Add contacts with their role, email, and phone -- mark one as primary',
      'Add facilities to pre-populate pickup and delivery addresses',
      'Create pricing playbooks to auto-apply rates when quoting for this customer',
    ],
    tips: [
      'Pricing playbooks automatically apply when building quotes for this customer\'s lanes',
      'The primary contact is used as the default recipient for quotes and invoices',
    ],
  },

  carriers: {
    title: 'Carriers',
    description:
      'Directory of all your carriers and trucking companies. See MC/DOT numbers, equipment types, safety ratings, and compliance status.',
    features: [
      'View all carriers with status, contact info, and equipment capabilities',
      'Add new carriers with MC/DOT numbers and insurance details',
      'Monitor insurance expiration dates and compliance status',
      'Click any carrier to view their full profile and performance metrics',
    ],
    howToUse: [
      'Click "Add Carrier" to create a new carrier record',
      'Click any carrier row to open their detailed profile',
      'Watch for warning icons indicating expiring insurance or compliance issues',
    ],
    tips: [
      'Keep insurance certificates current -- carriers with expired insurance are flagged during dispatch',
      'Equipment types determine which loads a carrier can be suggested for',
    ],
  },

  'carrier-detail': {
    title: 'Carrier Detail',
    description:
      'Complete carrier profile with contacts, compliance documents, equipment capabilities, performance metrics, and load history.',
    features: [
      'View and manage carrier contacts, insurance, and compliance documents',
      'Performance dashboard: on-time rate, tender acceptance, average cost per mile',
      'Insurance and authority tracking with expiration warnings',
      'View load history and lane coverage',
      'Capacity postings and negotiation history',
    ],
    howToUse: [
      'Use the tabs to navigate between Overview, Compliance, Performance, and History',
      'Upload compliance documents and track their expiration dates',
      'Review the performance scorecard before selecting this carrier for a load',
      'Use the compliance check to verify the carrier\'s current standing',
    ],
    tips: [
      'AI-powered compliance checks can automatically verify insurance and authority status',
      'Carriers with declining on-time rates are flagged for review',
    ],
  },

  loadboards: {
    title: 'Load Boards',
    description:
      'Integration with external load boards like DAT and Truckstop. Post available loads to attract carrier bids and search for available carriers on specific lanes.',
    features: [
      'Post loads to DAT, Truckstop, and other load boards',
      'Search for available carriers on specific lanes',
      'View market rate intelligence to price loads competitively',
      'Compare spot market rates against your contract rates',
    ],
    howToUse: [
      'Use the "My Postings" tab to manage your posted loads',
      'Use "Find Carriers" to search for available capacity on a lane',
      'Check "Market Rates" for current rate benchmarks by lane',
      'Use "Spot vs Contract" to compare your pricing strategy against the market',
    ],
    tips: [
      'Market rate data helps you set competitive tender offers on the dispatch board',
      'Posting loads to multiple boards simultaneously increases your carrier pool',
    ],
  },

  invoices: {
    title: 'Invoices',
    description:
      'Manage customer invoices across all stages: draft, sent, and paid. Create invoices from delivered shipments, track payments, and view aging reports.',
    features: [
      'View all invoices filtered by status',
      'Create invoices from delivered shipments (single or batch)',
      'Track payments and outstanding balances',
      'View accounts receivable aging reports',
      'Batch invoice generation for multiple shipments',
    ],
    howToUse: [
      'Use the Invoices tab to browse and manage individual invoices',
      'Use the Aging Report tab to see outstanding receivables by age bucket',
      'Use the Batch tab to generate multiple invoices at once from delivered shipments',
      'Click an invoice to view details, send to customer, or record payment',
    ],
    tips: [
      'Batch invoicing is fastest when you have multiple delivered shipments for the same customer',
      'Review the aging report weekly to follow up on overdue payments',
    ],
  },

  'billing-queue': {
    title: 'Billing Queue',
    description:
      'Streamlined workflow for managing invoices, carrier bills, aging reports, quick pay offers, and factoring assignments all in one place.',
    features: [
      'View receivables and payables aging in a unified dashboard',
      'Process carrier invoices and match against expected costs',
      'Manage quick pay offers for early carrier payment discounts',
      'Handle factoring assignments for carrier bill financing',
      'Batch invoice generation from delivered shipments',
      'Cash flow projections based on current receivables and payables',
    ],
    howToUse: [
      'Use the tabs to switch between different billing functions',
      'Review the aging overview to identify overdue receivables and payables',
      'Process carrier invoices by matching them against shipment records',
      'Use batch generation to create multiple customer invoices at once',
    ],
    tips: [
      'Quick pay offers typically give a 2-5% discount for paying carriers within 48 hours',
      'Cash flow projections help you plan around payment cycles',
    ],
  },

  'carrier-payables': {
    title: 'Carrier Payables',
    description:
      'Track what you owe carriers for completed loads. Match carrier bills against expected costs, approve payments, and manage quick pay and factoring.',
    features: [
      'View all carrier bills and their payment status',
      'Match carrier invoices against expected costs from tenders',
      'Approve or dispute carrier bills',
      'Manage quick pay offers for early payment discounts',
      'Handle factoring company assignments',
      'View payables aging report',
    ],
    howToUse: [
      'Review incoming carrier invoices in the carrier bills tab',
      'Compare billed amounts against the expected cost from the original tender',
      'Approve matching bills for payment or flag discrepancies for review',
      'Use the quick pay tab to offer early payment discounts to carriers',
    ],
    tips: [
      'Discrepancies between billed and expected amounts are highlighted automatically',
      'Building a reputation for fast payment (via quick pay) attracts better carrier rates',
    ],
  },

  margins: {
    title: 'Margins',
    description:
      'Profit analysis dashboard showing margins by shipment, customer, lane, and carrier. Identify your most and least profitable areas.',
    features: [
      'View overall margin metrics and trends',
      'Break down profitability by customer, carrier, and lane',
      'Identify top-performing and underperforming segments',
      'Track margin trends over time',
    ],
    howToUse: [
      'Review the summary cards for overall margin health',
      'Use the breakdowns to identify which customers, carriers, or lanes drive the most profit',
      'Click into specific segments to see detailed shipment-level data',
      'Compare current margins against historical averages',
    ],
    tips: [
      'Lanes with consistently low margins may need rate renegotiation',
      'High-volume customers with thin margins can still be profitable if managed efficiently',
    ],
  },

  'carrier-performance': {
    title: 'Carrier Performance',
    description:
      'Scorecard for every carrier: on-time delivery rate, tender acceptance, claims ratio, and cost efficiency. Use data to make better selection and negotiation decisions.',
    features: [
      'View carrier scorecards with key performance indicators',
      'Compare carriers side by side on reliability and cost',
      'Identify top performers and underperformers',
      'Track performance trends over time',
    ],
    howToUse: [
      'Review the overall performance summary at the top',
      'Scroll through individual carrier scorecards',
      'Use the data when selecting carriers on the dispatch board',
      'Reference performance metrics during carrier rate negotiations',
    ],
    tips: [
      'On-time percentage and tender acceptance rate are the strongest predictors of carrier reliability',
      'Share performance scorecards with carriers to encourage improvement',
    ],
  },

  'operations-metrics': {
    title: 'Operations Metrics',
    description:
      'Operational KPIs: work items processed, quote performance, tender analytics, and team productivity metrics.',
    features: [
      'Track work items created vs. completed over time',
      'Monitor quote conversion rates and response times',
      'Analyze tender acceptance and rejection patterns',
      'View productivity metrics by time period (7, 30, or 90 days)',
    ],
    howToUse: [
      'Select a time period using the buttons in the top right',
      'Review the summary cards for high-level operational health',
      'Use the detailed breakdowns to identify bottlenecks',
      'Compare current metrics against previous periods to spot trends',
    ],
    tips: [
      'A rising exception rate may indicate carrier quality issues',
      'Improving quote response time directly impacts win rate',
    ],
  },

  'lane-intelligence': {
    title: 'Lane Intelligence',
    description:
      'Analyze profitability and volume by origin-destination lane. See which lanes you are winning and losing on, with carrier performance data per lane.',
    features: [
      'View top lanes ranked by volume, revenue, or margin',
      'See carrier performance data for each lane',
      'Identify profitable lanes to double down on',
      'Spot underperforming lanes that need pricing adjustments',
    ],
    howToUse: [
      'Use the sort dropdown to rank lanes by different metrics',
      'Click into a lane to see which carriers run it and their performance',
      'Compare your rates against market benchmarks for each lane',
    ],
    tips: [
      'Focus carrier development efforts on your highest-volume lanes',
      'Lanes with high volume but low margins are prime candidates for rate renegotiation',
    ],
  },

  'customer-profitability': {
    title: 'Customer Profitability',
    description:
      'Revenue and margin analysis per customer. Identify your most valuable and least profitable customers to support data-driven pricing decisions.',
    features: [
      'View profitability metrics for every customer',
      'Sort by margin, revenue, or shipment count',
      'Track trends in customer shipping volume and pricing',
      'Expand individual customers to see lane-level detail',
    ],
    howToUse: [
      'Select a time period (30 days, 90 days, or 1 year)',
      'Sort by the metric most relevant to your analysis',
      'Click the expand arrow on any customer to see their lane breakdown',
      'Use the insights to prepare for customer pricing discussions',
    ],
    tips: [
      'Customers with high volume but declining margins may need a rate review',
      'The lane-level breakdown reveals which specific routes drive profitability',
    ],
  },

  'document-review': {
    title: 'Document Review',
    description:
      'Manual verification queue for documents that could not be automatically matched to shipments. Review AI classifications, correct errors, and link documents.',
    features: [
      'Review documents that need manual matching',
      'See AI-suggested document types and shipment matches',
      'Correct classification errors and reassign documents',
      'Track review queue statistics',
    ],
    howToUse: [
      'Review each document in the queue',
      'Verify or correct the AI-suggested document type (BOL, POD, invoice, etc.)',
      'Link the document to the correct shipment',
      'Approve or reject the classification to move it out of the queue',
    ],
    tips: [
      'Documents with low AI confidence scores need the most attention',
      'Correcting AI classifications helps improve future accuracy',
    ],
  },

  'document-inbox': {
    title: 'Document Inbox',
    description:
      'Landing zone for incoming documents not yet classified. AI automatically classifies document type and suggests matching shipments for your review.',
    features: [
      'View all incoming unclassified documents',
      'AI auto-classification of document types (BOL, POD, invoice, etc.)',
      'AI-suggested shipment matching with confidence scores',
      'Batch upload support for multiple documents',
    ],
    howToUse: [
      'Use "Batch Upload" to add multiple documents at once',
      'Review AI suggestions for each document -- confirm or reassign',
      'Click a document to see its details and AI classification',
      'Approve matches to automatically link documents to shipments',
    ],
    tips: [
      'Drag and drop files for faster uploading',
      'Documents with auto-matched shipments (green badge) have high-confidence AI matches',
    ],
  },

  'approval-center': {
    title: 'Approval Center',
    description:
      'Unified queue for items requiring your approval. Quotes exceeding margin thresholds, high-value shipments, and carrier exceptions all land here.',
    features: [
      'View all pending approval requests in one place',
      'One-click approve or reject with optional comments',
      'Configure auto-approval thresholds',
      'See approval statistics and processing times',
    ],
    howToUse: [
      'Review pending items at the top of the queue',
      'Click approve or reject for each item',
      'Add comments when rejecting to explain the reason',
      'Adjust auto-approval thresholds in the settings to reduce manual work',
    ],
    tips: [
      'Setting reasonable auto-approval thresholds reduces bottlenecks while maintaining control',
      'Items are sorted by priority -- address the oldest ones first to keep things moving',
    ],
  },

  'edi-manager': {
    title: 'EDI Manager',
    description:
      'Manage Electronic Data Interchange (EDI) with trading partners. Handle EDI 204 (tender), 214 (tracking), and 210 (invoice) messages.',
    features: [
      'Configure and manage trading partner connections',
      'View message log with send/receive status',
      'Send EDI 204 (load tender), 214 (status update), and 210 (invoice) messages',
      'Monitor message flow and resolve errors',
      'Track partner-level statistics',
    ],
    howToUse: [
      'Use the Partners tab to set up and manage trading partner configurations',
      'View the Message Log to see all EDI messages and their status',
      'Use the Send tab to manually create and send EDI messages',
      'Check error indicators and resolve failed messages promptly',
    ],
    tips: [
      'EDI 214 updates keep your customers informed automatically without manual check calls',
      'Test new partner configurations with a single message before enabling full automation',
    ],
  },

  'rate-tables': {
    title: 'Rate Tables',
    description:
      'Manage contract rates and pricing agreements. Set up lane-specific rates, fuel surcharge schedules, and accessorial charges.',
    features: [
      'Create and manage rate tables with lane-specific pricing',
      'Look up rates by origin, destination, and equipment type',
      'Track expiring rate contracts',
      'Import and export rate tables for bulk management',
    ],
    howToUse: [
      'Use the Rate Tables tab to create or edit pricing agreements',
      'Use Rate Lookup to quickly find the contracted rate for a specific lane',
      'Check Expiring Contracts to proactively renegotiate before rates lapse',
      'Use import/export for bulk rate table management',
    ],
    tips: [
      'Rate tables are automatically applied when building quotes for matching lanes',
      'Set calendar reminders for contract expirations so you are never caught off guard',
    ],
  },

  communications: {
    title: 'Communications',
    description:
      'Central hub for customer and carrier communications. Send SMS, voice calls, and emails using templates, and track communication history.',
    features: [
      'Send SMS and voice messages to carriers and customers',
      'Manage reusable message templates for common scenarios',
      'Track check call schedules and overdue calls',
      'View complete communication history per contact',
    ],
    howToUse: [
      'Use the Send tab to compose and send messages',
      'Manage templates in the Templates tab for consistent messaging',
      'Check the Check Calls tab to see which calls are due or overdue',
      'Review the History tab for a full log of all communications',
    ],
    tips: [
      'Templates with variables (like shipment number and ETA) save time and reduce errors',
      'Proactive check calls to carriers improve tracking accuracy and customer satisfaction',
    ],
  },

  automations: {
    title: 'Automations',
    description:
      'Build automation rules in plain English -- no code required. Automate routine tasks like creating invoices on delivery, sending check call reminders, and flagging exceptions.',
    features: [
      'Define rules using natural language (e.g., "When a shipment is delivered, create an invoice")',
      'Test rules in sandbox/shadow mode before activating them',
      'Monitor execution results and error rates',
      'Gradually roll out automations with confidence',
    ],
    howToUse: [
      'Click "New Rule" to define an automation in plain English',
      'Use the Test Panel to simulate how a rule would behave',
      'Start rules in "shadow" mode to see what they would do without actually executing',
      'Promote to "active" once you are confident in the rule\'s behavior',
    ],
    tips: [
      'Start with simple, low-risk automations (like sending notifications) before automating business-critical actions',
      'Shadow mode execution logs show you exactly what would have happened',
    ],
  },

  'desk-management': {
    title: 'Desk Management',
    description:
      'Organize your team into specialized desks (e.g., East Coast, Flatbed, Priority). Set routing rules to auto-assign work items based on criteria.',
    features: [
      'Create desks for different specializations or regions',
      'Define routing rules that auto-assign incoming work items',
      'Set coverage schedules for each desk',
      'Balance workload across team members',
      'Auto-route all unassigned work items with one click',
    ],
    howToUse: [
      'Click "New Desk" to create a desk for a team or specialization',
      'Define routing rules (e.g., "Route flatbed loads to the Flatbed desk")',
      'Set coverage hours so work routes correctly during shifts',
      'Use "Auto-Route All" to process all unrouted work items',
    ],
    tips: [
      'Well-defined routing rules reduce manual triage and speed up response times',
      'Review desk workload distribution regularly to prevent burnout',
    ],
  },

  'role-management': {
    title: 'Role Management',
    description:
      'Configure role-based access control (RBAC). Define what each role can see and do with 40+ granular permissions.',
    features: [
      'Manage default roles: Admin, Dispatcher, Sales, Billing Clerk, Viewer',
      'Create custom roles for your organization\'s needs',
      'Assign granular permissions (view, create, edit, delete) per resource',
      'Assign roles to team members',
    ],
    howToUse: [
      'Review existing roles in the Roles tab',
      'Click a role to view and edit its permissions',
      'Use the Permissions tab for a matrix view of all permissions across roles',
      'Assign roles to users in the Users tab',
    ],
    tips: [
      'Follow the principle of least privilege -- give users only the permissions they need',
      'The Viewer role is useful for customers or stakeholders who need read-only access',
    ],
  },

  'tenant-settings': {
    title: 'Organization Settings',
    description:
      'Configure your organization\'s TMS settings including timezone, currency, numbering schemes, branding, and team management.',
    features: [
      'Set timezone, currency, and number formats',
      'Customize shipment, quote, and invoice numbering schemes',
      'Manage branding and notification preferences',
      'Invite and manage team members',
      'Configure custom fields for your workflows',
    ],
    howToUse: [
      'Review and update each settings section as needed',
      'Click "Save" in the top right after making changes',
      'Use the team management section to invite new users',
      'Set numbering prefixes to match your existing systems',
    ],
    tips: [
      'Setting the correct timezone ensures all timestamps display correctly for your team',
      'Custom numbering prefixes help maintain consistency if you are migrating from another system',
    ],
  },

  settings: {
    title: 'Settings',
    description:
      'Personal user preferences including notification settings, display preferences, default views, and integrations.',
    features: [
      'Update your profile information',
      'Configure notification preferences (email, in-app, SMS)',
      'Set company-level defaults for equipment types and accessorials',
      'Manage integrations with external services',
    ],
    howToUse: [
      'Navigate between sections using the sidebar tabs',
      'Update your profile details in the Profile section',
      'Toggle notifications on or off for each category',
      'Set default equipment types and other preferences in the Defaults section',
    ],
    tips: [
      'Turning off low-priority notifications reduces noise and helps you focus on critical alerts',
      'Setting default equipment types speeds up quote and shipment creation',
    ],
  },

  'report-builder': {
    title: 'Report Builder',
    description:
      'Create custom reports by selecting fields, filters, and groupings from your TMS data. Export to CSV or PDF and save configurations for reuse.',
    features: [
      'Choose from available data sources: shipments, invoices, carriers, customers',
      'Select specific columns to include in your report',
      'Apply filters and groupings to narrow the data',
      'Export reports to CSV or PDF',
      'Save report configurations for future use',
    ],
    howToUse: [
      'Select a data source from the dropdown',
      'Add columns you want to include in the report',
      'Set any filters to narrow the data (e.g., date range, status)',
      'Click "Run Report" to generate results',
      'Use "Save" to store the configuration for later',
    ],
    tips: [
      'Start with a broad report and narrow down -- it is easier to remove columns than to guess what you need',
      'Saved reports can be used as the basis for scheduled reports',
    ],
  },

  'scheduled-reports': {
    title: 'Scheduled Reports',
    description:
      'Set up reports to run automatically on a schedule. Daily, weekly, or monthly delivery via email to keep your team informed without manual effort.',
    features: [
      'Schedule reports to run daily, weekly, or monthly',
      'Deliver reports via email to one or more recipients',
      'Manage active report schedules',
      'View history of past report deliveries',
    ],
    howToUse: [
      'Click "Schedule Report" to create a new scheduled report',
      'Select the report configuration, frequency, and recipients',
      'Toggle schedules on or off without deleting them',
      'Check the delivery history to confirm reports are being sent',
    ],
    tips: [
      'Weekly margin reports help management stay on top of profitability trends',
      'Schedule operational metrics reports for Monday mornings to start the week informed',
    ],
  },

  'global-search': {
    title: 'Global Search',
    description:
      'Search across everything: shipments, customers, carriers, quotes, and invoices. Find anything by reference number, name, city, or any field.',
    features: [
      'Search across all entity types simultaneously',
      'Find records by reference number, name, city, or any field',
      'Filter results by type (shipment, customer, carrier)',
      'Recent searches are saved for quick re-access',
    ],
    howToUse: [
      'Open search with Cmd+K (Mac) or Ctrl+K (Windows) from anywhere',
      'Type your search query -- results appear as you type',
      'Click a result to navigate directly to that record',
      'Use recent searches to quickly revisit previous queries',
    ],
    tips: [
      'Searching by shipment number or customer name is the fastest way to find records',
      'The keyboard shortcut (Cmd+K) works from any page in the TMS',
    ],
  },
}

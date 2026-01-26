# End-to-End Test Suite - Expertly Define

## Prerequisites

### Environment Variables (must be set in Coolify)
```
NEXTAUTH_URL=https://define.ai.devintensive.com
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
ANTHROPIC_API_KEY=<your Anthropic API key>
```

### Test Credentials
- Email: `david@example.com`
- Password: `expertly123`

---

## Test Suite

### 1. Authentication Flow

#### 1.1 Unauthenticated Redirect
- [ ] Visit https://define.ai.devintensive.com/
- [ ] **Expected**: Redirected to /login page
- [ ] **Verify**: Login form is displayed with email and password fields

#### 1.2 Login with Valid Credentials
- [ ] Enter email: `david@example.com`
- [ ] Enter password: `expertly123`
- [ ] Click "Sign in"
- [ ] **Expected**: Redirected to Dashboard
- [ ] **Verify**: Header shows user name and logout button

#### 1.3 Login with Invalid Credentials
- [ ] Enter email: `wrong@example.com`
- [ ] Enter password: `wrongpassword`
- [ ] Click "Sign in"
- [ ] **Expected**: Error message "Invalid email or password"
- [ ] **Verify**: Remains on login page

#### 1.4 Logout
- [ ] While logged in, click the logout button in header
- [ ] **Expected**: Redirected to /login page
- [ ] **Verify**: Cannot access protected pages

---

### 2. Products Management

#### 2.1 View Products List
- [ ] Navigate to /products
- [ ] **Expected**: Products list page loads
- [ ] **Verify**: "New Product" button is visible

#### 2.2 Create New Product
- [ ] Click "New Product" button
- [ ] Enter name: "Test Product"
- [ ] Enter description: "A test product for E2E testing"
- [ ] Click "Create"
- [ ] **Expected**: Product created, appears in list
- [ ] **Verify**: Product card shows name and description

#### 2.3 View Product Details
- [ ] Click on the created product
- [ ] **Expected**: Product detail page loads
- [ ] **Verify**:
  - Product name displayed in header
  - "Product map" sidebar visible
  - Detail panel shows "Select a requirement" message

---

### 3. Requirements Management

#### 3.1 Create Single Requirement (Plus Button)
- [ ] On product detail page, click the "+" button
- [ ] **Expected**: "Add Requirement" dialog opens
- [ ] Fill in:
  - Title: "User Authentication"
  - What this does: "Users can log in with email and password"
  - Status: Draft
  - Priority: High
- [ ] Click "Create"
- [ ] **Expected**: Requirement appears in the tree
- [ ] **Verify**: Badge shows "draft" status

#### 3.2 View Requirement Details
- [ ] Click on the requirement in the tree
- [ ] **Expected**: Detail panel shows requirement info
- [ ] **Verify**:
  - Stable key badge (e.g., "TST-001")
  - Priority badge
  - "Open requirement" button visible

#### 3.3 Create Child Requirement
- [ ] Click "+" button again
- [ ] Fill in:
  - Title: "Login Form"
  - Parent: Select "User Authentication"
- [ ] Click "Create"
- [ ] **Expected**: Child requirement appears nested under parent
- [ ] **Verify**: Tree shows proper indentation

---

### 4. AI-Powered Bulk Import

#### 4.1 Open Bulk Import Dialog
- [ ] On product detail page, click the sparkles button (next to +)
- [ ] **Expected**: "Import Requirements with AI" dialog opens
- [ ] **Verify**:
  - Large textarea for description
  - File upload area
  - Optional parent selector

#### 4.2 Generate Requirements from Text
- [ ] Enter description: "We need user authentication with login, registration, password reset, and email verification"
- [ ] Click "Generate"
- [ ] **Expected**: AI generates 4-5 structured requirements
- [ ] **Verify**: Preview shows editable tree with titles like:
  - "User Authentication" (parent)
  - "Login" (child)
  - "Registration" (child)
  - "Password Reset" (child)
  - "Email Verification" (child)

#### 4.3 Edit Generated Requirement
- [ ] Click on one of the generated requirements
- [ ] Modify the title
- [ ] Click "Done"
- [ ] **Expected**: Title updates in preview

#### 4.4 Delete Generated Requirement
- [ ] Click the trash icon on a requirement
- [ ] **Expected**: Requirement removed from preview
- [ ] **Verify**: Children also removed if it was a parent

#### 4.5 Create All Requirements
- [ ] Click "Create All"
- [ ] **Expected**: Progress indicator shows, then dialog closes
- [ ] **Verify**: All requirements appear in the product tree with correct hierarchy

#### 4.6 File Upload (PDF)
- [ ] Open bulk import dialog
- [ ] Upload a PDF file with requirements text
- [ ] Enter brief description
- [ ] Click "Generate"
- [ ] **Expected**: AI incorporates PDF content into generated requirements

#### 4.7 File Upload (Image)
- [ ] Open bulk import dialog
- [ ] Upload an image (e.g., screenshot of a wireframe)
- [ ] Enter brief description
- [ ] Click "Generate"
- [ ] **Expected**: AI analyzes image and generates relevant requirements

---

### 5. Requirement Detail Page

#### 5.1 Navigate to Detail Page
- [ ] Click "Open requirement" on any requirement
- [ ] **Expected**: Full requirement detail page loads
- [ ] **Verify**: Tabs visible (Definition, Versions, etc.)

#### 5.2 View Version History
- [ ] Click "Versions" tab
- [ ] **Expected**: At least one version shown (v1 - Initial creation)

#### 5.3 Edit Requirement
- [ ] Modify a field and save
- [ ] **Expected**: New version created
- [ ] **Verify**: Version history shows v2

---

### 6. Jira Integration

#### 6.1 Configure Jira Settings
- [ ] On product page, click the Send icon button
- [ ] Click "Settings" in the dialog
- [ ] **Expected**: Jira settings dialog opens
- [ ] Fill in:
  - Jira Host: `yourcompany.atlassian.net`
  - Email: your Jira email
  - API Token: your Jira API token
  - Project Key: e.g., "PROJ"
- [ ] Click "Save"
- [ ] **Expected**: Settings saved, "Jira not configured" warning disappears

#### 6.2 Generate Jira Story Drafts
- [ ] Select a requirement in the tree
- [ ] Click "Draft Jira stories" button
- [ ] Click "Generate Stories"
- [ ] **Expected**: AI generates 1-3 Jira story drafts
- [ ] **Verify**: Each draft shows summary, description, issue type, priority

#### 6.3 Edit Jira Draft
- [ ] Click edit icon on a draft
- [ ] Modify summary and description
- [ ] Click "Save"
- [ ] **Expected**: Draft updates

#### 6.4 Send Draft to Jira (if configured)
- [ ] Click send icon on a draft
- [ ] **Expected**: Draft status changes to "sent"
- [ ] **Verify**: Jira issue key and link appear

---

### 7. Releases

#### 7.1 View Releases List
- [ ] Navigate to /releases
- [ ] **Expected**: Releases page loads
- [ ] **Verify**: "New Release" button visible

#### 7.2 Create Release Snapshot
- [ ] Click "New Release"
- [ ] Select a product
- [ ] Enter version name: "v1.0.0"
- [ ] Click "Create"
- [ ] **Expected**: Release created with requirements snapshot

---

### 8. Dashboard

#### 8.1 View Dashboard Stats
- [ ] Navigate to / (Dashboard)
- [ ] **Expected**: Dashboard shows:
  - Product count
  - Requirement count
  - Recent changes
  - Failing tests (if any)

---

### 9. Navigation

#### 9.1 Header Navigation
- [ ] Click "Dashboard" - goes to /
- [ ] Click "Products" - goes to /products
- [ ] Click "Releases" - goes to /releases
- [ ] **Verify**: Active nav item is highlighted

#### 9.2 Back Navigation
- [ ] From product detail, click "Products" breadcrumb
- [ ] **Expected**: Returns to products list

---

### 10. Error Handling

#### 10.1 Invalid Product ID
- [ ] Navigate to /products/invalid-id
- [ ] **Expected**: "Product not found" message

#### 10.2 API Error Handling
- [ ] Disconnect network, try to create a requirement
- [ ] **Expected**: Graceful error message, no crash

---

## Quick Smoke Test (5 minutes)

Run this subset to verify basic functionality:

1. [ ] Login with valid credentials
2. [ ] Navigate to Products
3. [ ] Create a new product
4. [ ] Click on product to view details
5. [ ] Create a requirement using the + button
6. [ ] Open AI bulk import dialog
7. [ ] Logout

---

## Known Issues / Notes

- The app requires `NEXTAUTH_SECRET` environment variable to be set
- The app requires `ANTHROPIC_API_KEY` for AI features
- PDF parsing requires the `pdf-parse` package to be properly installed
- Image analysis uses Claude Vision API

---

## Reporting Issues

When reporting a bug, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Browser console errors (F12 → Console)
5. Network errors (F12 → Network → filter by red)

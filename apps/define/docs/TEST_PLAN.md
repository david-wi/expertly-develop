# Expertly Define - Comprehensive Test Plan

## 1. Unit Tests

### 1.1 Database Operations (Completed)
- [x] Create product
- [x] Update product
- [x] Delete product
- [x] Create requirement with stable key generation
- [x] Create requirement version on creation
- [x] Support parent-child requirement relationships
- [x] Update requirement and increment version
- [x] Support different requirement statuses

### 1.2 API Endpoints
- [ ] GET /api/products - List all products with requirement counts
- [ ] POST /api/products - Create new product
- [ ] GET /api/products/[id] - Get product with requirements
- [ ] PUT /api/products/[id] - Update product
- [ ] DELETE /api/products/[id] - Delete product (cascade to requirements)
- [ ] GET /api/requirements?productId=X - List requirements for product
- [ ] POST /api/requirements - Create requirement
- [ ] GET /api/requirements/[id] - Get requirement with versions, links
- [ ] PUT /api/requirements/[id] - Update requirement (creates new version)
- [ ] DELETE /api/requirements/[id] - Delete requirement
- [ ] GET /api/releases - List release snapshots
- [ ] POST /api/releases - Create release snapshot
- [ ] GET /api/releases/[id] - Get release snapshot detail
- [ ] POST /api/ai/suggest - AI suggestion endpoint

## 2. Integration Tests

### 2.1 Product Lifecycle
- [ ] Create product -> Add requirements -> Delete product (cascade)
- [ ] Create product -> Add nested requirements -> Verify tree structure
- [ ] Update product -> Verify timestamp updates

### 2.2 Requirement Lifecycle
- [ ] Create requirement -> Verify stable key assigned (REQ-001)
- [ ] Create requirement -> Verify initial version created
- [ ] Update requirement -> Verify new version created
- [ ] Update requirement -> Verify old version marked superseded
- [ ] Create child requirement -> Verify parent relationship
- [ ] Move requirement -> Verify tree structure updates

### 2.3 Version History
- [ ] Multiple updates -> Verify version chain
- [ ] Version comparison -> Verify diff detection
- [ ] Version restore -> Verify creates new version (not overwrite)

### 2.4 Release Snapshots
- [ ] Create snapshot -> Verify requirements captured
- [ ] Create snapshot -> Verify stats calculated correctly
- [ ] View snapshot -> Verify point-in-time data preserved

## 3. End-to-End Tests

### 3.1 Dashboard (/)
- [ ] Empty state shows welcome message
- [ ] Products show in overview section
- [ ] Recent changes display correctly
- [ ] Failing tests show in "Checks that need love"
- [ ] Draft releases show in snapshot section

### 3.2 Products Page (/products)
- [ ] Empty state shows "No products yet"
- [ ] Create product dialog opens
- [ ] Create product with name only
- [ ] Create product with name and description
- [ ] Products list shows with requirement counts
- [ ] Click product navigates to detail page

### 3.3 Product Detail (/products/[id])
- [ ] Shows product name and breadcrumb
- [ ] Requirements tree displays correctly
- [ ] Tree nodes expand/collapse
- [ ] Select requirement shows preview
- [ ] Add requirement dialog opens
- [ ] Create root-level requirement
- [ ] Create child requirement with parent selected
- [ ] Search filters tree
- [ ] "Open requirement" navigates to detail

### 3.4 Requirement Detail (/requirements/[id])
- [ ] Shows requirement title and stable key
- [ ] Definition tab displays all fields
- [ ] Edit mode allows field updates
- [ ] Save creates new version
- [ ] Versions tab shows history
- [ ] Version diff shows changes
- [ ] Implementation tab shows code links
- [ ] Verification tab shows test links
- [ ] Delivery work tab shows external links
- [ ] Sidebar shows "At a glance" stats
- [ ] Quick actions work

### 3.5 Releases Page (/releases)
- [ ] Empty state when no products
- [ ] Empty state when no releases
- [ ] Create snapshot dialog opens
- [ ] Select product and version name
- [ ] Snapshot created with current requirements
- [ ] Releases list shows with stats
- [ ] Click release navigates to detail

### 3.6 Release Detail (/releases/[id])
- [ ] Shows release version name
- [ ] Progress bar shows verification percentage
- [ ] Requirements list displays snapshot
- [ ] Export and compare buttons present

## 4. Visual/UI Tests

### 4.1 Responsive Design
- [ ] Dashboard responsive on mobile
- [ ] Products page responsive on mobile
- [ ] Product detail responsive on mobile
- [ ] Requirement detail responsive on mobile

### 4.2 Component Styling
- [ ] Buttons use correct variants
- [ ] Cards have proper borders and shadows
- [ ] Badges show correct colors for statuses
- [ ] Forms display validation states
- [ ] Loading states show spinners

### 4.3 Navigation
- [ ] Header navigation highlights active route
- [ ] Breadcrumbs show correct hierarchy
- [ ] Back links work correctly

## 5. Edge Cases

### 5.1 Data Validation
- [ ] Cannot create product with empty name
- [ ] Cannot create requirement without productId
- [ ] Cannot create requirement with invalid parentId
- [ ] Large text fields handle gracefully

### 5.2 Error Handling
- [ ] 404 for non-existent product
- [ ] 404 for non-existent requirement
- [ ] 404 for non-existent release
- [ ] Network error shows feedback

### 5.3 Performance
- [ ] Product list loads quickly with many products
- [ ] Requirement tree handles deep nesting
- [ ] Version history handles many versions

## 6. AI Features

### 6.1 Suggestion Generation
- [ ] Requirement suggestion generates valid JSON
- [ ] Acceptance criteria suggestion works
- [ ] Subtree suggestion creates parent and children
- [ ] Error handling for API failures

## Test Execution Results

| Test Suite | Tests | Passed | Failed | Status |
|------------|-------|--------|--------|--------|
| Products API | 3 | 3 | 0 | PASS |
| Requirements API | 5 | 5 | 0 | PASS |
| **Total** | **8** | **8** | **0** | **PASS** |

## Manual E2E Test Screens

1. Dashboard - Empty state
2. Dashboard - With data
3. Products - Empty state
4. Products - List view
5. Products - Create dialog
6. Product Detail - Tree view
7. Product Detail - Add requirement
8. Requirement Detail - Definition tab
9. Requirement Detail - Versions tab
10. Requirement Detail - Edit mode
11. Releases - Empty state
12. Releases - List view
13. Release Detail - Snapshot view

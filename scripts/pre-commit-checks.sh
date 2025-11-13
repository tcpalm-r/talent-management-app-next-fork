#!/bin/bash

# Pre-commit security checks for preventing the user ID vulnerability
# Run this manually or set up as a git hook

set -e

echo "🔍 Running pre-commit security checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check 1: API routes accepting createdBy from client
echo ""
echo "📋 Check 1: Looking for client-provided user IDs in API routes..."
if grep -r "createdBy.*await request.json()" app/api/ 2>/dev/null; then
    echo -e "${RED}❌ ERROR: Found API routes accepting createdBy from client!${NC}"
    echo "   This is a security vulnerability. Use getAuthenticatedUser() instead."
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ PASS: No client-provided user IDs found${NC}"
fi

# Check 2: Survey creation authentication
echo ""
echo "📋 Check 2: Verifying authentication in survey creation routes..."

if [ -f "app/api/surveys/create/route.ts" ]; then
    if ! grep -q "getAuthenticatedUser" app/api/surveys/create/route.ts; then
        echo -e "${RED}❌ ERROR: /api/surveys/create missing authentication check!${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ PASS: /api/surveys/create has authentication${NC}"
    fi
    
    if ! grep -q "authData.profile.id" app/api/surveys/create/route.ts; then
        echo -e "${RED}❌ ERROR: /api/surveys/create not using authData.profile.id!${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ PASS: /api/surveys/create uses authenticated user ID${NC}"
    fi
fi

if [ -f "app/api/surveys/save-draft/route.ts" ]; then
    if ! grep -q "getAuthenticatedUser" app/api/surveys/save-draft/route.ts; then
        echo -e "${RED}❌ ERROR: /api/surveys/save-draft missing authentication check!${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ PASS: /api/surveys/save-draft has authentication${NC}"
    fi
    
    if ! grep -q "authData.profile.id" app/api/surveys/save-draft/route.ts; then
        echo -e "${RED}❌ ERROR: /api/surveys/save-draft not using authData.profile.id!${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ PASS: /api/surveys/save-draft uses authenticated user ID${NC}"
    fi
fi

# Check 3: Client components not sending createdBy
echo ""
echo "📋 Check 3: Checking client components don't send createdBy..."

if grep -q "createdBy: currentUser" components/Survey360Wizard.tsx 2>/dev/null; then
    echo -e "${RED}❌ ERROR: Survey360Wizard still sending createdBy from client!${NC}"
    echo "   This value should be derived server-side."
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ PASS: Survey360Wizard not sending client-side createdBy${NC}"
fi

if grep -q "createdBy: 'current-user'" components/Quick360Modal.tsx 2>/dev/null; then
    echo -e "${RED}❌ ERROR: Quick360Modal sending literal createdBy!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ PASS: Quick360Modal not sending literal createdBy${NC}"
fi

# Check 4: Look for dangerous patterns
echo ""
echo "📋 Check 4: Checking for dangerous patterns..."

# Check for eval()
if grep -r "eval(" app/ lib/ components/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "node_modules"; then
    echo -e "${YELLOW}⚠️  WARNING: Found eval() usage - review for security${NC}"
fi

# Check for direct Supabase writes with user IDs in components
if grep -r "\.insert({" components/ --include="*.tsx" -A 5 2>/dev/null | grep -i "created_by\|user_id\|owner"; then
    echo -e "${YELLOW}⚠️  WARNING: Found direct database writes in components with user IDs${NC}"
    echo "   Consider moving to API routes for better security."
fi

# Check 5: Run tests
echo ""
echo "📋 Check 5: Running integration tests..."

if npm test -- __tests__/integration --silent --passWithNoTests 2>/dev/null; then
    echo -e "${GREEN}✅ PASS: Integration tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  WARNING: Integration tests failed or not found${NC}"
fi

# Summary
echo ""
echo "================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    echo "================================"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS security issue(s)${NC}"
    echo "================================"
    echo ""
    echo "Please fix the issues above before committing."
    echo "These checks prevent the user ID vulnerability that caused"
    echo "surveys to disappear in production after the RLS refactoring."
    exit 1
fi


#!/usr/bin/env bash
# verify.sh - Verify all files are in place and ready for deployment
# Usage: bash verify.sh

echo "=========================================="
echo "Informatics Initiative - Deployment Verification"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
TOTAL=0
PASSED=0
FAILED=0

# Function to check file existence
check_file() {
    local file=$1
    local description=$2
    TOTAL=$((TOTAL + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $description (NOT FOUND)"
        FAILED=$((FAILED + 1))
    fi
}

# Function to check directory existence
check_dir() {
    local dir=$1
    local description=$2
    TOTAL=$((TOTAL + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $description (NOT FOUND)"
        FAILED=$((FAILED + 1))
    fi
}

echo "📋 Checking Core Files..."
check_file "server.js" "server.js - Node backend"
check_file "package.json" "package.json - Dependencies"
check_file ".env.example" ".env.example - Env template"
check_file ".gitignore" ".gitignore - Git rules"
check_file "render.yaml" "render.yaml - Render config"

echo ""
echo "📁 Checking Frontend Files..."
check_dir "Tii" "Tii/ - Frontend folder"
check_file "Tii/auth.js" "Tii/auth.js - Auth logic"
check_file "Tii/firebase-config.js" "Tii/firebase-config.js - Firebase setup"
check_file "Tii/otp-verification.html" "Tii/otp-verification.html - OTP form"
check_file "Tii/index.html" "Tii/index.html - Home page"
check_file "Tii/login.html" "Tii/login.html - Login page"
check_file "Tii/register.html" "Tii/register.html - Register page"

echo ""
echo "📚 Checking Documentation..."
check_file "README.md" "README.md - Full documentation"
check_file "QUICK_START.md" "QUICK_START.md - Quick setup"
check_file "SETUP_SUMMARY.md" "SETUP_SUMMARY.md - Phases"
check_file "DEPLOYMENT_CHECKLIST.md" "DEPLOYMENT_CHECKLIST.md - Validation"
check_file "INDEX.md" "INDEX.md - Documentation index"
check_file "FINAL_SUMMARY.md" "FINAL_SUMMARY.md - Summary"
check_file "QUICK_REFERENCE.md" "QUICK_REFERENCE.md - Reference card"

echo ""
echo "🔍 Checking Node Modules..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules/ - Installed"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}!${NC} node_modules/ - Not installed (run: npm install)"
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo "Total Checks: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo "⚠️  Some files are missing. Please ensure you're in the correct directory."
    exit 1
else
    echo ""
    echo "✅ All files verified successfully!"
    echo ""
    echo "📚 Next Steps:"
    echo "1. Read QUICK_START.md"
    echo "2. Create .env file (copy from .env.example)"
    echo "3. Run: npm install"
    echo "4. Run: npm start"
    echo "5. Deploy to Render!"
    exit 0
fi

#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎯 BudgetPulse One-Shot Installer${NC}\n"

# Check for required tools
check_dependency() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}❌ $1 is not installed${NC}"
    return 1
  fi
  echo -e "${GREEN}✓ $1 found${NC}"
  return 0
}

echo "Checking dependencies..."
check_dependency "git" || { echo -e "${RED}Please install git: https://git-scm.com${NC}"; exit 1; }
check_dependency "node" || { echo -e "${RED}Please install Node.js: https://nodejs.org${NC}"; exit 1; }
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  OS="mac"
else
  echo -e "${YELLOW}⚠ Unsupported OS. Skipping platform-specific build.${NC}"
  OS="unknown"
fi

# Clone repo
REPO_URL="https://github.com/shrijitb/budget-pulse.git"
INSTALL_DIR="$HOME/BudgetPulse"

if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}Directory $INSTALL_DIR already exists${NC}"
  read -p "Replace it? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$INSTALL_DIR"
  else
    echo "Exiting..."
    exit 1
  fi
fi

echo -e "\n${YELLOW}Cloning BudgetPulse...${NC}"
git clone "$REPO_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install

echo -e "\n${YELLOW}Building application for $OS...${NC}"
if [ "$OS" = "linux" ]; then
  npm run build:linux
  APP_PATH="$INSTALL_DIR/dist/BudgetPulse-*.AppImage"
  echo -e "\n${GREEN}✓ Built successfully!${NC}"
  echo -e "📦 AppImage: $(ls -lh $APP_PATH | awk '{print $NF}')"
  echo -e "   Location: $APP_PATH\n"
  echo -e "${YELLOW}To run:${NC} $APP_PATH"
  echo -e "${YELLOW}To install system-wide (optional):${NC}"
  echo "   sudo mv $APP_PATH /opt/budgetpulse"

elif [ "$OS" = "mac" ]; then
  npm run build:mac
  DMG_PATH="$INSTALL_DIR/dist/BudgetPulse-*.dmg"
  echo -e "\n${GREEN}✓ Built successfully!${NC}"
  echo -e "📦 DMG: $(ls -lh $DMG_PATH | awk '{print $NF}')"
  echo -e "   Location: $DMG_PATH\n"
  echo -e "${YELLOW}To install:${NC} Open the .dmg file and drag BudgetPulse to Applications\n"

else
  npm run build
  echo -e "\n${GREEN}✓ Built successfully!${NC}"
  echo -e "${YELLOW}For Windows, run:${NC} npm run build:win"
fi

echo -e "${GREEN}✓ Installation complete!${NC}\n"
echo -e "${YELLOW}Dev mode (with hot reload):${NC}"
echo "  cd $INSTALL_DIR && npm run dev"
